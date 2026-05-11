"use server";

import { z } from "zod";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";

const DAILY_LIMIT = 5;

const startSchema = z.object({
  visitorName: z.string().trim().min(1).max(60),
  nativeLanguage: z.enum(["vi", "en", "other"]),
});

export type McqQuestion = {
  id: string;
  level_target: string;
  question_ko: string;
  question_vi: string;
  choices: { ko: string; vi: string }[];
  weight: number;
};

export type StartResult =
  | { ok: true; id: string; questions: McqQuestion[] }
  | { ok: false; error: "rate_limited" | "invalid_input" | "no_questions" };

export async function startPlacementTest(
  input: z.infer<typeof startSchema>
): Promise<StartResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { visitorName, nativeLanguage } = parsed.data;

  const fp = await getVisitorFingerprint();
  const limit = (await sql`
    select count(*)::int as cnt
    from placement_tests
    where visitor_fingerprint = ${fp}
      and created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
      and created_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
  `) as { cnt: number }[];
  if ((limit[0]?.cnt ?? 0) >= DAILY_LIMIT) {
    return { ok: false, error: "rate_limited" };
  }

  const questions = (await sql`
    select id, level_target::text as level_target, question_ko, question_vi,
           choices, weight
    from mcq_questions
    where active = true and version = 'v1'
    order by case level_target
      when 'beginner' then 1
      when 'elementary' then 2
      when 'intermediate' then 3
      when 'advanced' then 4
    end, created_at
    limit 5
  `) as McqQuestion[];
  if (questions.length === 0) return { ok: false, error: "no_questions" };

  const inserted = (await sql`
    insert into placement_tests
      (visitor_name, visitor_fingerprint, native_language, mcq_answers, mcq_score, status)
    values (${visitorName}, ${fp}, ${nativeLanguage}, '[]'::jsonb, 0, 'pending')
    returning id
  `) as { id: string }[];

  return { ok: true, id: inserted[0].id, questions };
}

const submitMcqSchema = z.object({
  id: z.string().uuid(),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), choiceIndex: z.number().int().min(0).max(10) }))
    .min(1)
    .max(20),
});

export type SubmitMcqResult =
  | { ok: true; mcqScore: number; mcqLevel: string }
  | { ok: false; error: string };

export async function submitMcq(
  input: z.infer<typeof submitMcqSchema>
): Promise<SubmitMcqResult> {
  const parsed = submitMcqSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id from placement_tests
    where id = ${parsed.data.id} and visitor_fingerprint = ${fp}
    limit 1
  `) as { id: string }[];
  if (!owned[0]) return { ok: false, error: "forbidden" };

  const ids = parsed.data.answers.map((a) => a.questionId);
  const questions = (await sql`
    select id::text, answer_index, weight
    from mcq_questions
    where id = any(${ids}::uuid[])
  `) as { id: string; answer_index: number; weight: number }[];
  const qMap = new Map(questions.map((q) => [q.id, q]));

  let totalScore = 0;
  const enrichedAnswers = parsed.data.answers.map((a) => {
    const q = qMap.get(a.questionId);
    const correct = q ? a.choiceIndex === q.answer_index : false;
    if (correct && q) totalScore += q.weight;
    return {
      qid: a.questionId,
      choice_index: a.choiceIndex,
      correct,
      weight: q?.weight ?? 0,
    };
  });

  const settings = (await sql`
    select value from app_settings where key = 'mcq_level_thresholds' limit 1
  `) as { value: Record<string, [number, number]> }[];
  const thresholds = settings[0]?.value ?? {
    beginner: [0, 1],
    elementary: [2, 3],
    intermediate: [4, 5],
    advanced: [6, 7],
  };
  const mcqLevel =
    Object.entries(thresholds).find(
      ([, range]) => totalScore >= range[0] && totalScore <= range[1]
    )?.[0] ?? "beginner";

  await sql`
    update placement_tests
    set mcq_answers = ${JSON.stringify(enrichedAnswers)}::jsonb,
        mcq_score = ${totalScore}
    where id = ${parsed.data.id}
  `;

  return { ok: true, mcqScore: totalScore, mcqLevel };
}

const startPronSchema = z.object({
  placementId: z.string().uuid(),
  visitorName: z.string().trim().min(1).max(60),
  nativeLanguage: z.enum(["vi", "en", "other"]),
  koreanLevel: z.enum(["beginner", "elementary", "intermediate", "advanced"]),
  targetSentence: z.string().min(1).max(200),
});

export async function startPlacementPronunciation(
  input: z.infer<typeof startPronSchema>
): Promise<{ ok: true; pronunciationTestId: string } | { ok: false; error: string }> {
  const parsed = startPronSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id from placement_tests where id = ${parsed.data.placementId} and visitor_fingerprint = ${fp} limit 1
  `) as { id: string }[];
  if (!owned[0]) return { ok: false, error: "forbidden" };

  const inserted = (await sql`
    insert into free_pronunciation_tests
      (visitor_name, visitor_fingerprint, native_language, korean_level, target_sentence, status)
    values (${parsed.data.visitorName}, ${fp}, ${parsed.data.nativeLanguage},
            ${parsed.data.koreanLevel}::korean_level,
            ${parsed.data.targetSentence}, 'pending')
    returning id
  `) as { id: string }[];

  await sql`
    update placement_tests
    set pronunciation_test_id = ${inserted[0].id}
    where id = ${parsed.data.placementId}
  `;

  return { ok: true, pronunciationTestId: inserted[0].id };
}

const linkPronSchema = z.object({
  id: z.string().uuid(),
  pronunciationTestId: z.string().uuid(),
});

export async function linkPronunciationToPlacement(
  input: z.infer<typeof linkPronSchema>
): Promise<{ ok: boolean; error?: string }> {
  const parsed = linkPronSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id from placement_tests where id = ${parsed.data.id} and visitor_fingerprint = ${fp} limit 1
  `) as { id: string }[];
  if (!owned[0]) return { ok: false, error: "forbidden" };

  await sql`
    update placement_tests
    set pronunciation_test_id = ${parsed.data.pronunciationTestId},
        status = 'processing'
    where id = ${parsed.data.id}
  `;
  return { ok: true };
}

export type PlacementResult = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  visitorName: string;
  mcqScore: number;
  recommendedLevel: string | null;
  pronunciation: {
    score: number | null;
    strengths: string | null;
    improvements: string | null;
    targetSentence: string | null;
    transcript: string | null;
    status: string | null;
    recommendedClassLevel: string | null;
  } | null;
};

const LEVEL_RANK: Record<string, number> = {
  beginner: 1,
  elementary: 2,
  intermediate: 3,
  advanced: 4,
};
const RANK_LEVEL: Record<number, string> = {
  1: "beginner",
  2: "elementary",
  3: "intermediate",
  4: "advanced",
};

export async function getPlacementResult(id: string): Promise<PlacementResult | null> {
  const fp = await getVisitorFingerprint();
  const rows = (await sql`
    select pt.id, pt.status::text, pt.visitor_name, pt.mcq_score,
           pt.recommended_level::text as recommended_level,
           pt.pronunciation_test_id,
           fpt.score as pron_score, fpt.strengths, fpt.improvements,
           fpt.target_sentence, fpt.transcript, fpt.status::text as pron_status,
           fpt.recommended_class_level::text as pron_level
    from placement_tests pt
    left join free_pronunciation_tests fpt on fpt.id = pt.pronunciation_test_id
    where pt.id = ${id} and pt.visitor_fingerprint = ${fp}
    limit 1
  `) as Array<{
    id: string;
    status: PlacementResult["status"];
    visitor_name: string;
    mcq_score: number;
    recommended_level: string | null;
    pronunciation_test_id: string | null;
    pron_score: number | null;
    strengths: string | null;
    improvements: string | null;
    target_sentence: string | null;
    transcript: string | null;
    pron_status: string | null;
    pron_level: string | null;
  }>;
  if (!rows[0]) return null;
  const r = rows[0];

  // 발음 채점이 끝났고 placement가 아직 미완성이면 여기서 최종 레벨 산출
  if (
    r.pronunciation_test_id &&
    r.pron_status === "completed" &&
    r.recommended_level === null
  ) {
    const settings = (await sql`
      select value from app_settings where key = 'mcq_level_thresholds' limit 1
    `) as { value: Record<string, [number, number]> }[];
    const thresholds = settings[0]?.value ?? {};
    const mcqLevel =
      Object.entries(thresholds).find(
        ([, range]) => r.mcq_score >= range[0] && r.mcq_score <= range[1]
      )?.[0] ?? "beginner";

    const pronLevel = r.pron_level ?? mcqLevel;
    const blended = Math.round(
      (LEVEL_RANK[mcqLevel] ?? 1) * 0.6 + (LEVEL_RANK[pronLevel] ?? 1) * 0.4
    );
    let finalLevel = RANK_LEVEL[blended] ?? mcqLevel;

    // 두 결과가 1단계 이상 차이나면 보수적으로 낮은 쪽 채택
    const gap = Math.abs((LEVEL_RANK[mcqLevel] ?? 1) - (LEVEL_RANK[pronLevel] ?? 1));
    if (gap >= 2) {
      finalLevel = LEVEL_RANK[mcqLevel] < LEVEL_RANK[pronLevel] ? mcqLevel : pronLevel;
    }

    await sql`
      update placement_tests
      set recommended_level = ${finalLevel}::korean_level, status = 'completed'
      where id = ${id}
    `;
    r.recommended_level = finalLevel;
    r.status = "completed";
  }

  return {
    id: r.id,
    status: r.status,
    visitorName: r.visitor_name,
    mcqScore: r.mcq_score,
    recommendedLevel: r.recommended_level,
    pronunciation: r.pronunciation_test_id
      ? {
          score: r.pron_score,
          strengths: r.strengths,
          improvements: r.improvements,
          targetSentence: r.target_sentence,
          transcript: r.transcript,
          status: r.pron_status,
          recommendedClassLevel: r.pron_level,
        }
      : null,
  };
}
