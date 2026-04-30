import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";
import { Recorder } from "./recorder";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const fp = await getVisitorFingerprint();

  const rows = (await sql`
    select id, target_sentence, status, visitor_name
    from free_pronunciation_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as Array<{
    id: string;
    target_sentence: string;
    status: string;
    visitor_name: string;
  }>;
  if (!rows[0]) notFound();
  const test = rows[0];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">Step 2 / 3</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
        {test.visitor_name}님, 아래 문장을 따라 읽어보세요
      </h1>

      <div className="mt-6 rounded-2xl border-2 border-[var(--color-primary)]/30 bg-[var(--color-soft)] p-8 text-center">
        <p className="text-2xl font-bold leading-relaxed text-[var(--color-ink)] sm:text-3xl">
          {test.target_sentence}
        </p>
      </div>

      <div className="mt-8">
        <Recorder testId={test.id} />
      </div>

      <p className="mt-6 text-xs text-[var(--color-muted)]">
        💡 조용한 환경에서 또박또박 읽어주세요. 녹음은 최대 30초입니다.
      </p>
    </div>
  );
}
