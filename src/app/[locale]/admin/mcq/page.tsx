import { getTranslations, getLocale } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { ToggleActive } from "./toggle-active";
import { ThresholdEditor } from "./threshold-editor";

type LevelKey = "beginner" | "elementary" | "intermediate" | "advanced";

type Question = {
  id: string;
  level_target: LevelKey;
  question_ko: string;
  question_vi: string;
  choices: { ko: string; vi: string }[];
  answer_index: number;
  weight: number;
  active: boolean;
};

export default async function AdminMcqPage() {
  const t = await getTranslations("admin.mcq");
  const tLevel = await getTranslations("admin.mcq.level");
  const locale = await getLocale();
  const orgId = await getCurrentOrgId();
  // 학원 전용 문항 + 공통 문항 (organization_id is null)
  const questions = (await sql`
    select id::text, level_target::text, question_ko, question_vi, choices,
           answer_index, weight, active
    from mcq_questions
    where organization_id = ${orgId} or organization_id is null
    order by case level_target
      when 'beginner' then 1
      when 'elementary' then 2
      when 'intermediate' then 3
      when 'advanced' then 4
    end, created_at
  `) as Question[];

  type Thresholds = Record<
    "beginner" | "elementary" | "intermediate" | "advanced",
    [number, number]
  >;
  const settings = (await sql`
    select value from app_settings
    where organization_id = ${orgId} and key = 'mcq_level_thresholds'
    limit 1
  `) as { value: Thresholds }[];
  const thresholds: Thresholds = settings[0]?.value ?? {
    beginner: [0, 1],
    elementary: [2, 3],
    intermediate: [4, 5],
    advanced: [6, 7],
  };

  const isVi = locale === "vi";

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("subtitle")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">{t("thresholdTitle")}</h2>
        <ThresholdEditor initial={thresholds} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-bold">
          {t("questionsTitle", { count: questions.length })}
        </h2>
        <ul className="grid gap-3">
          {questions.map((q, i) => {
            const primary = isVi ? q.question_vi : q.question_ko;
            const secondary = isVi ? q.question_ko : q.question_vi;
            return (
              <li
                key={q.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[var(--color-soft)] px-2.5 py-0.5 font-bold">
                        Q{i + 1}
                      </span>
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 font-semibold">
                        {tLevel(q.level_target)}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                        {t("weight", { n: q.weight })}
                      </span>
                    </div>
                    <p className="mt-2 font-bold">{primary}</p>
                    {secondary && secondary !== primary && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{secondary}</p>
                    )}
                    <ol className="mt-3 grid gap-1 text-xs">
                      {q.choices.map((c, ci) => {
                        const choicePrimary = isVi ? c.vi : c.ko;
                        return (
                          <li
                            key={ci}
                            className={`flex items-center gap-2 rounded px-2 py-1 ${
                              ci === q.answer_index
                                ? "bg-emerald-50 font-semibold text-emerald-700"
                                : "text-[var(--color-muted)]"
                            }`}
                          >
                            <span className="w-5">{String.fromCharCode(65 + ci)}.</span>
                            <span>{choicePrimary}</span>
                            {ci === q.answer_index && <span>{t("correctTag")}</span>}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <ToggleActive id={q.id} active={q.active} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
