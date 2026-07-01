import { sql } from "@/lib/db/client";
import { generateJsonWithRetry, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { normalizeSkill, normText, type QuestionType, type Skill } from "./scoring";

// ---- 객관식류 자동 채점 (순수) ----
export function gradeObjective(
  q: { question_type: QuestionType; correct_answer: unknown; points: number },
  ans: { selected_option: unknown; answer_text: string | null }
): { isCorrect: boolean; awarded: number } {
  const pts = q.points ?? 0;
  switch (q.question_type) {
    case "multiple_choice":
    case "true_false": {
      const ok =
        ans.selected_option !== null &&
        ans.selected_option !== undefined &&
        String(ans.selected_option) === String(q.correct_answer);
      return { isCorrect: ok, awarded: ok ? pts : 0 };
    }
    case "matching": {
      const correct = Array.isArray(q.correct_answer) ? q.correct_answer : [];
      const sel = Array.isArray(ans.selected_option) ? ans.selected_option : [];
      if (!correct.length) return { isCorrect: false, awarded: 0 };
      let c = 0;
      for (let i = 0; i < correct.length; i++) if (String(sel[i]) === String(correct[i])) c++;
      return { isCorrect: c === correct.length, awarded: Math.round((pts * c) / correct.length) };
    }
    case "fill_blank": {
      const acc = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
      const a = normText(ans.answer_text ?? "");
      const ok = a.length > 0 && acc.some((x) => normText(String(x)) === a);
      return { isCorrect: ok, awarded: ok ? pts : 0 };
    }
    case "arrange_sentence": {
      const correct = normText(String(q.correct_answer ?? ""));
      const a = normText(ans.answer_text ?? "");
      return { isCorrect: correct.length > 0 && a === correct, awarded: correct.length > 0 && a === correct ? pts : 0 };
    }
    default:
      return { isCorrect: false, awarded: 0 };
  }
}

// ---- 쓰기 서술형 AI 1차 채점 ----
const WRITING_SCHEMA = {
  type: "object",
  properties: { score: { type: "integer" }, feedback: { type: "string" } },
  required: ["score", "feedback"],
} as const;

export async function gradeWritingAI(input: {
  questionText: string;
  reference: string;
  text: string;
  maxPoints: number;
}): Promise<{ score: number; feedback: string }> {
  const { questionText, reference, text, maxPoints } = input;
  if (!isAIConfigured() || !text.trim()) {
    return { score: text.trim() ? Math.round(maxPoints * 0.7) : 0, feedback: "" };
  }
  const prompt = `당신은 한국어 학원 교사입니다. 학생의 쓰기 답안을 ${maxPoints}점 만점으로 채점하세요.
문제: ${questionText}
${reference ? `참고 정답/예시: ${reference}` : ""}
학생 답안: ${text}
평가 기준: 문법 정확성, 어휘 정확성, 문항 요구 충족, 자연스러움, 맞춤법·종결어미.
- score: 0~${maxPoints} 정수
- feedback: 한국어 1~2문장`;
  try {
    const raw = await generateJsonWithRetry(prompt, WRITING_SCHEMA);
    const p = JSON.parse(raw) as { score?: number; feedback?: string };
    return {
      score: Math.max(0, Math.min(maxPoints, Math.round(Number(p.score) || 0))),
      feedback: (p.feedback ?? "").toString().slice(0, 1000),
    };
  } catch {
    return { score: Math.round(maxPoints * 0.7), feedback: "" };
  }
}

// ---- 결과 집계 (영역별 /100 정규화 → 총 400 → 평균) ----
export async function recomputeResult(testId: string, studentId: string, organizationId: string): Promise<void> {
  const qs = (await sql`
    select id::text, skill, points from weekly_questions where test_id = ${testId}::uuid
  `) as { id: string; skill: Skill; points: number }[];
  const possible: Record<Skill, number> = { listening: 0, reading: 0, writing: 0, speaking: 0 };
  const skillOf = new Map<string, Skill>();
  for (const q of qs) {
    possible[q.skill] += q.points ?? 0;
    skillOf.set(q.id, q.skill);
  }

  const ans = (await sql`
    select question_id::text, auto_score, ai_score, teacher_score, final_score
    from weekly_answers where test_id = ${testId}::uuid and student_id = ${studentId}::uuid
  `) as {
    question_id: string;
    auto_score: number | null;
    ai_score: number | null;
    teacher_score: number | null;
    final_score: number | null;
  }[];

  const finalAward: Record<Skill, number> = { listening: 0, reading: 0, writing: 0, speaking: 0 };
  let writingAiRaw = 0;
  for (const a of ans) {
    const sk = skillOf.get(a.question_id);
    if (!sk) continue;
    const fin = a.final_score ?? a.teacher_score ?? a.auto_score ?? a.ai_score ?? 0;
    finalAward[sk] += fin;
    if (sk === "writing") writingAiRaw += a.ai_score ?? a.auto_score ?? 0;
  }

  const listening = normalizeSkill(finalAward.listening, possible.listening);
  const reading = normalizeSkill(finalAward.reading, possible.reading);
  const speaking = normalizeSkill(finalAward.speaking, possible.speaking);
  const writingFinal = normalizeSkill(finalAward.writing, possible.writing);
  const writingAi = normalizeSkill(writingAiRaw, possible.writing);
  const total = listening + reading + writingFinal + speaking;
  const average = Math.round((total / 4) * 100) / 100;

  await sql`
    insert into weekly_results
      (test_id, student_id, organization_id, listening_score, reading_score,
       writing_ai_score, writing_final_score, speaking_score, total_score, average_score)
    values
      (${testId}::uuid, ${studentId}::uuid, ${organizationId}, ${listening}, ${reading},
       ${writingAi}, ${writingFinal}, ${speaking}, ${total}, ${average})
    on conflict (test_id, student_id) do update set
      listening_score = excluded.listening_score, reading_score = excluded.reading_score,
      writing_ai_score = excluded.writing_ai_score, writing_final_score = excluded.writing_final_score,
      speaking_score = excluded.speaking_score, total_score = excluded.total_score,
      average_score = excluded.average_score, updated_at = now()
  `;
}
