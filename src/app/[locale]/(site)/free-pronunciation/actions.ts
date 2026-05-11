"use server";

import { z } from "zod";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";

const DAILY_LIMIT = 5;

const startSchema = z.object({
  visitorName: z.string().trim().min(1).max(60),
  nativeLanguage: z.enum(["vi", "en", "other"]),
  koreanLevel: z.enum(["beginner", "elementary", "intermediate", "advanced"]),
});

export type StartInput = z.infer<typeof startSchema>;

export type StartResult =
  | { ok: true; id: string; targetSentence: string }
  | { ok: false; error: "rate_limited" | "invalid_input" | "no_sentence" };

export async function startFreePronunciationTest(
  input: StartInput
): Promise<StartResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { visitorName, nativeLanguage, koreanLevel } = parsed.data;

  const fp = await getVisitorFingerprint();

  const limit = (await sql`
    select count(*)::int as cnt
    from free_pronunciation_tests
    where visitor_fingerprint = ${fp}
      and created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
      and created_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
  `) as { cnt: number }[];
  if ((limit[0]?.cnt ?? 0) >= DAILY_LIMIT) {
    return { ok: false, error: "rate_limited" };
  }

  const sentenceRow = (await sql`
    select text from sentences where level = ${koreanLevel} order by random() limit 1
  `) as { text: string }[];
  if (!sentenceRow[0]) return { ok: false, error: "no_sentence" };
  const targetSentence = sentenceRow[0].text;

  const inserted = (await sql`
    insert into free_pronunciation_tests
      (visitor_name, visitor_fingerprint, native_language, korean_level, target_sentence, status)
    values (${visitorName}, ${fp}, ${nativeLanguage}, ${koreanLevel}, ${targetSentence}, 'pending')
    returning id
  `) as { id: string }[];

  return { ok: true, id: inserted[0].id, targetSentence };
}

const submitSchema = z.object({
  id: z.string().uuid(),
  audioUrl: z.string().url(),
});

export async function submitAudioUrl(
  input: z.infer<typeof submitSchema>
): Promise<{ ok: boolean; error?: string }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id from free_pronunciation_tests
    where id = ${parsed.data.id} and visitor_fingerprint = ${fp}
    limit 1
  `) as { id: string }[];
  if (!owned[0]) return { ok: false, error: "forbidden" };

  await sql`
    update free_pronunciation_tests
    set audio_url = ${parsed.data.audioUrl}
    where id = ${parsed.data.id}
  `;
  return { ok: true };
}

export type FreePronunciationResult = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  visitorName: string;
  targetSentence: string;
  transcript: string | null;
  score: number | null;
  strengths: string | null;
  improvements: string | null;
  recommendedClassLevel: string | null;
};

export async function getFreePronunciationResult(
  id: string
): Promise<FreePronunciationResult | null> {
  const fp = await getVisitorFingerprint();
  const rows = (await sql`
    select id, status, visitor_name, target_sentence, transcript, score,
           strengths, improvements, recommended_class_level
    from free_pronunciation_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as Array<{
    id: string;
    status: FreePronunciationResult["status"];
    visitor_name: string;
    target_sentence: string;
    transcript: string | null;
    score: number | null;
    strengths: string | null;
    improvements: string | null;
    recommended_class_level: string | null;
  }>;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    status: r.status,
    visitorName: r.visitor_name,
    targetSentence: r.target_sentence,
    transcript: r.transcript,
    score: r.score,
    strengths: r.strengths,
    improvements: r.improvements,
    recommendedClassLevel: r.recommended_class_level,
  };
}
