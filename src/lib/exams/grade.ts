import { sql } from "@/lib/db/client";
import { generateJsonWithRetry, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { SECTIONS, type Section } from "./scoring";

// 쓰기 AI 채점 — 점수(0~만점)와 피드백 초안. AI 미설정 시 만점의 70% mock.
const WRITING_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    feedback: { type: "string" },
  },
  required: ["score", "feedback"],
} as const;

export async function gradeWritingText(input: {
  prompt: string;
  text: string;
  maxPoints: number;
}): Promise<{ score: number; feedback: string }> {
  const { prompt, text, maxPoints } = input;
  if (!isAIConfigured() || !text.trim()) {
    return { score: text.trim() ? Math.round(maxPoints * 0.7) : 0, feedback: "" };
  }
  const p = `당신은 한국어 학원 교사입니다. 학생의 쓰기 답안을 ${maxPoints}점 만점으로 채점하세요.
문제: ${prompt}
학생 답안: ${text}

평가 기준: 과제 적합성, 문법 정확성, 어휘 사용, 완성도.
- score: 0~${maxPoints} 사이 정수
- feedback: 한국어로 1~2문장, 잘한 점과 보완점`;
  try {
    const raw = await generateJsonWithRetry(p, WRITING_SCHEMA);
    const parsed = JSON.parse(raw) as { score?: number; feedback?: string };
    const score = Math.max(0, Math.min(maxPoints, Math.round(Number(parsed.score) || 0)));
    return { score, feedback: (parsed.feedback ?? "").toString().slice(0, 1000) };
  } catch {
    return { score: Math.round(maxPoints * 0.7), feedback: "" };
  }
}

// 응시의 섹션별 점수·총점을 graded 답안에서 재집계하고 status를 갱신한다.
export async function recomputeAttempt(attemptId: string): Promise<void> {
  const attempts = (await sql`
    select id::text, exam_id::text, status from exam_attempts where id = ${attemptId}::uuid limit 1
  `) as { id: string; exam_id: string; status: string }[];
  if (!attempts[0]) return;
  const att = attempts[0];

  // 시험 섹션 배점(가중치)
  const exRows = (await sql`
    select w_listening, w_reading, w_grammar, w_writing, w_speaking
    from exams where id = ${att.exam_id}::uuid limit 1
  `) as Array<Record<string, number>>;
  const weight: Record<Section, number> = {
    listening: exRows[0]?.w_listening ?? 20,
    reading: exRows[0]?.w_reading ?? 20,
    grammar_vocab: exRows[0]?.w_grammar ?? 30,
    writing: exRows[0]?.w_writing ?? 15,
    speaking: exRows[0]?.w_speaking ?? 15,
  };

  // 문항: 섹션 매핑 + 섹션별 만점(배점 합)
  const qs = (await sql`
    select id::text, section, points from exam_questions where exam_id = ${att.exam_id}::uuid
  `) as { id: string; section: string; points: number }[];
  const sectionOf = new Map(qs.map((q) => [q.id, q.section as Section]));
  const possible: Record<Section, number> = {
    listening: 0, reading: 0, grammar_vocab: 0, writing: 0, speaking: 0,
  };
  for (const q of qs) possible[q.section as Section] += q.points ?? 0;

  const ans = (await sql`
    select question_id::text, awarded_points, status from exam_answers where attempt_id = ${attemptId}::uuid
  `) as { question_id: string; awarded_points: number | null; status: string }[];

  const rawAwarded: Record<Section, number> = {
    listening: 0, reading: 0, grammar_vocab: 0, writing: 0, speaking: 0,
  };
  let pending = 0;
  for (const a of ans) {
    const sec = sectionOf.get(a.question_id);
    if (!sec) continue;
    if (a.status === "pending" || a.status === "processing") pending++;
    if (a.awarded_points !== null) rawAwarded[sec] += a.awarded_points;
  }

  // 섹션 원점수를 배점(weight)으로 환산 → 총점 100 스케일
  const secScore: Record<Section, number> = {
    listening: 0, reading: 0, grammar_vocab: 0, writing: 0, speaking: 0,
  };
  for (const s of SECTIONS) {
    const poss = possible[s.key];
    secScore[s.key] = poss > 0 ? Math.round((rawAwarded[s.key] / poss) * weight[s.key]) : 0;
  }
  const total = SECTIONS.reduce((acc, s) => acc + secScore[s.key], 0);

  // 제출된 응시이고 미채점 답안이 없으면 완료
  const nextStatus = att.status === "submitted" && pending === 0 ? "completed" : att.status;

  await sql`
    update exam_attempts set
      listening_score = ${secScore.listening},
      reading_score = ${secScore.reading},
      grammar_vocab_score = ${secScore.grammar_vocab},
      writing_score = ${secScore.writing},
      speaking_score = ${secScore.speaking},
      total_score = ${total},
      status = ${nextStatus},
      updated_at = now()
    where id = ${attemptId}::uuid
  `;
}
