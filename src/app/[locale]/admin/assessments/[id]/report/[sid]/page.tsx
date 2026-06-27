import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import {
  AREA_LABELS,
  DEFAULT_CUTS,
  GRADE_META,
  average,
  grade,
  rankByAverage,
  total,
  type AreaScores,
  type GradeCuts,
} from "@/lib/assessments/scoring";
import { PrintButton } from "./print-button";
import { CommentEditor } from "./comment-editor";

type ScoreRow = {
  student_id: string;
  name: string;
  student_code: string | null;
  listening_score: number | null;
  speaking_score: number | null;
  reading_score: number | null;
  writing_score: number | null;
  pronunciation_score: number | null;
  parent_comment: string | null;
};

function toScores(r: ScoreRow): AreaScores {
  return {
    listening: r.listening_score,
    speaking: r.speaking_score,
    reading: r.reading_score,
    writing: r.writing_score,
    pronunciation: r.pronunciation_score,
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;
  const orgId = await getCurrentOrgId();

  const rounds = (await sql`
    select r.id::text, r.title, r.class_id::text,
           c.name as class_name, to_char(r.assessment_date, 'YYYY-MM-DD') as date
    from assessment_rounds r join classes c on c.id = r.class_id
    where r.id = ${id}::uuid and r.organization_id = ${orgId} limit 1
  `) as { id: string; title: string; class_id: string; class_name: string; date: string }[];
  if (!rounds[0]) notFound();
  const round = rounds[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${orgId} limit 1
  `) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  // 회차 전체 점수 (순위 계산용)
  const all = (await sql`
    select s.id::text as student_id, s.name, s.student_code,
           sc.listening_score, sc.speaking_score, sc.reading_score, sc.writing_score, sc.pronunciation_score,
           sc.parent_comment
    from students s
    left join assessment_scores sc on sc.student_id = s.id and sc.round_id = ${id}::uuid
    where s.class_id = ${round.class_id}::uuid and s.organization_id = ${orgId}
  `) as ScoreRow[];

  const me = all.find((r) => r.student_id === sid);
  if (!me) notFound();

  const scores = toScores(me);
  const avg = average(scores);
  const g = grade(avg, cuts);
  const rankMap = rankByAverage(all.map((r) => ({ id: r.student_id, scores: toScores(r) })));
  const rank = rankMap.get(sid);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/admin/assessments/${round.id}`}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          ← 결과로 돌아가기
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div>
            <p className="eyebrow">다낭 K-Talk Lab</p>
            <h1 className="mt-1 text-xl font-bold">주말 학습 결과 보고서</h1>
          </div>
          <span className="brand-gradient grid size-10 place-items-center rounded-lg text-sm font-black text-white">
            다프
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-[var(--color-muted)]">학생</span>{" "}
            <span className="font-bold">{me.name}</span>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">학번</span>{" "}
            <span className="font-semibold">{me.student_code ?? "—"}</span>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">반</span>{" "}
            <span className="font-semibold">{round.class_name}</span>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">평가</span>{" "}
            <span className="font-semibold">
              {round.title} ({round.date})
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[var(--color-soft)] p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
            영역별 점수
          </p>
          <div className="space-y-2.5">
            {AREA_LABELS.map((a) => {
              const v = scores[a.key];
              return (
                <div key={a.key} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-sm font-semibold">{a.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white">
                    <div className="brand-gradient h-full rounded-full" style={{ width: `${v ?? 0}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">
                    {v ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <p className="text-xs text-[var(--color-muted)]">총점</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{total(scores)} / 500</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <p className="text-xs text-[var(--color-muted)]">평균</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{avg ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <p className="text-xs text-[var(--color-muted)]">반 내 순위</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {rank ?? "—"} / {all.length}
            </p>
          </div>
        </div>

        {g && (
          <div className="mt-5 flex items-center justify-center">
            <div className={`rounded-full px-6 py-2 text-base font-bold ${GRADE_META[g].tone}`}>
              등급: {GRADE_META[g].dot} {GRADE_META[g].label}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
            학부모 코멘트
          </p>
          <CommentEditor
            roundId={round.id}
            studentId={sid}
            initial={me.parent_comment ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
