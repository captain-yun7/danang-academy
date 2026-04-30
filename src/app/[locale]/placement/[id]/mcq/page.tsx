import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";
import { McqQuiz } from "./mcq-quiz";
import type { McqQuestion } from "../../actions";

export default async function McqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fp = await getVisitorFingerprint();

  const owned = (await sql`
    select id, visitor_name, mcq_score
    from placement_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as { id: string; visitor_name: string; mcq_score: number }[];
  if (!owned[0]) notFound();

  const questions = (await sql`
    select id::text, level_target::text as level_target, question_ko, question_vi,
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

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">Step 2 / 4</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
        {owned[0].visitor_name}님, 객관식 5문항입니다
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        직감대로 빠르게 풀어주세요. 모르면 추측해도 괜찮아요.
      </p>
      <div className="mt-8">
        <McqQuiz placementId={id} questions={questions} />
      </div>
    </div>
  );
}
