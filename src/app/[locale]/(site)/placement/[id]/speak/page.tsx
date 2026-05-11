import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";
import { SpeakStep } from "./speak-step";

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

export default async function SpeakPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fp = await getVisitorFingerprint();

  const owned = (await sql`
    select id, visitor_name, native_language::text, mcq_score
    from placement_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as {
    id: string;
    visitor_name: string;
    native_language: string;
    mcq_score: number;
  }[];
  if (!owned[0]) notFound();
  const placement = owned[0];

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
      ([, range]) => placement.mcq_score >= range[0] && placement.mcq_score <= range[1]
    )?.[0] ?? "beginner";

  // 발음 문장: MCQ 레벨에서 한 단계 낮춰 무난하게 — 선택사항이지만 좌절 방지
  const sentenceLevel =
    RANK_LEVEL[Math.max(1, (LEVEL_RANK[mcqLevel] ?? 1) - 1)] ?? mcqLevel;
  const row = (await sql`
    select text from sentences where level = ${sentenceLevel}::korean_level order by random() limit 1
  `) as { text: string }[];
  const targetSentence = row[0]?.text ?? "안녕하세요. 반갑습니다.";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">Step 3 / 4</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
        {placement.visitor_name}님, 한 문장만 따라 읽어볼까요?
      </h1>

      <div className="mt-6 rounded-2xl border-2 border-[var(--color-primary)]/30 bg-[var(--color-soft)] p-8 text-center">
        <p className="text-2xl font-bold leading-relaxed text-[var(--color-ink)] sm:text-3xl">
          {targetSentence}
        </p>
      </div>

      <div className="mt-8">
        <SpeakStep
          placementId={placement.id}
          visitorName={placement.visitor_name}
          nativeLanguage={placement.native_language}
          koreanLevel={mcqLevel}
          targetSentence={targetSentence}
        />
      </div>

      <p className="mt-6 text-xs text-[var(--color-muted)]">
        💡 조용한 환경에서 또박또박 읽어주세요. 녹음은 최대 30초입니다.
      </p>
    </div>
  );
}
