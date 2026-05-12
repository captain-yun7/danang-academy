import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { McqQuiz } from "./mcq-quiz";
import type { McqQuestion } from "../../actions";

export default async function McqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fp = await getVisitorFingerprint();
  const orgId = await getCurrentOrgId();

  const owned = (await sql`
    select id, visitor_name, mcq_score
    from placement_tests
    where id = ${id} and visitor_fingerprint = ${fp} and organization_id = ${orgId}
    limit 1
  `) as { id: string; visitor_name: string; mcq_score: number }[];
  if (!owned[0]) notFound();

  const questions = (await sql`
    select id::text, level_target::text as level_target, question_ko, question_vi,
           choices, weight
    from mcq_questions
    where active = true and version = 'v1'
      and (organization_id = ${orgId} or organization_id is null)
    order by case level_target
      when 'beginner' then 1
      when 'elementary' then 2
      when 'intermediate' then 3
      when 'advanced' then 4
    end, created_at
    limit 5
  `) as McqQuestion[];

  const t = await getTranslations("pt.mcq");

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">{t("step")}</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
        {t("title", { name: owned[0].visitor_name })}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{t("hint")}</p>
      <div className="mt-8">
        <McqQuiz placementId={id} questions={questions} />
      </div>
    </div>
  );
}
