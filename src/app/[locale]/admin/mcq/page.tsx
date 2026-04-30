import { sql } from "@/lib/db/client";
import { ToggleActive } from "./toggle-active";
import { ThresholdEditor } from "./threshold-editor";

type Question = {
  id: string;
  level_target: string;
  question_ko: string;
  question_vi: string;
  choices: { ko: string; vi: string }[];
  answer_index: number;
  weight: number;
  active: boolean;
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export default async function AdminMcqPage() {
  const questions = (await sql`
    select id::text, level_target::text, question_ko, question_vi, choices,
           answer_index, weight, active
    from mcq_questions
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
    select value from app_settings where key = 'mcq_level_thresholds' limit 1
  `) as { value: Thresholds }[];
  const thresholds: Thresholds = settings[0]?.value ?? {
    beginner: [0, 1],
    elementary: [2, 3],
    intermediate: [4, 5],
    advanced: [6, 7],
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Placement / MCQ
          </p>
          <h1 className="mt-1 text-2xl font-bold">레벨테스트 문항 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            객관식 문항 활성/비활성 토글 + 점수→레벨 임계값 조정.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">점수 임계값</h2>
        <ThresholdEditor initial={thresholds} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-bold">문항 목록 ({questions.length})</h2>
        <ul className="grid gap-3">
          {questions.map((q, i) => (
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
                      {LEVEL_LABEL[q.level_target] ?? q.level_target}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                      가중치 {q.weight}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">{q.question_ko}</p>
                  {q.question_vi && q.question_vi !== q.question_ko && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {q.question_vi}
                    </p>
                  )}
                  <ol className="mt-3 grid gap-1 text-xs">
                    {q.choices.map((c, ci) => (
                      <li
                        key={ci}
                        className={`flex items-center gap-2 rounded px-2 py-1 ${
                          ci === q.answer_index
                            ? "bg-emerald-50 font-semibold text-emerald-700"
                            : "text-[var(--color-muted)]"
                        }`}
                      >
                        <span className="w-5">{String.fromCharCode(65 + ci)}.</span>
                        <span>{c.ko}</span>
                        {ci === q.answer_index && <span>✓ 정답</span>}
                      </li>
                    ))}
                  </ol>
                </div>
                <ToggleActive id={q.id} active={q.active} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
