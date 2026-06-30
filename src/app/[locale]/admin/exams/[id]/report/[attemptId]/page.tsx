import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { SECTIONS, grade, GRADE_META, DEFAULT_CUTS, rankByTotal, type GradeCuts, type Section } from "@/lib/exams/scoring";
import { PrintButton } from "../../../../assessments/[id]/report/[sid]/print-button";
import { ExamCommentEditor } from "./comment-editor";

export default async function ExamReportPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select e.title, c.name as class_name, to_char(e.exam_date,'YYYY-MM-DD') as date,
           e.w_listening, e.w_reading, e.w_grammar, e.w_writing, e.w_speaking,
           a.id::text as attempt_id, st.name, st.student_code, a.total_score, a.parent_comment, a.status,
           a.listening_score, a.reading_score, a.grammar_vocab_score, a.writing_score, a.speaking_score
    from exam_attempts a
    join exams e on e.id = a.exam_id
    join classes c on c.id = e.class_id
    join students st on st.id = a.student_id
    where a.id = ${attemptId}::uuid and a.exam_id = ${id}::uuid and a.organization_id = ${orgId}
    limit 1
  `) as Array<Record<string, string | number | null>>;
  if (!rows[0]) notFound();
  const r = rows[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${orgId} limit 1
  `) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  const allRows = (await sql`
    select id::text, total_score from exam_attempts where exam_id = ${id}::uuid and organization_id = ${orgId}
  `) as { id: string; total_score: number | null }[];
  const rankMap = rankByTotal(allRows.map((a) => ({ id: a.id, total: a.total_score })));
  const rank = rankMap.get(attemptId);

  const total = (r.total_score as number) ?? 0;
  const g = grade(total, cuts);
  const sections: Record<Section, number | null> = {
    listening: r.listening_score as number | null,
    reading: r.reading_score as number | null,
    grammar_vocab: r.grammar_vocab_score as number | null,
    writing: r.writing_score as number | null,
    speaking: r.speaking_score as number | null,
  };
  const weights: Record<Section, number> = {
    listening: r.w_listening as number,
    reading: r.w_reading as number,
    grammar_vocab: r.w_grammar as number,
    writing: r.w_writing as number,
    speaking: r.w_speaking as number,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/admin/exams/${id}/results`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          ← 응시 현황으로
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div>
            <p className="eyebrow">다낭 K-Talk Lab</p>
            <h1 className="mt-1 text-xl font-bold">복습 시험 결과 보고서</h1>
          </div>
          <span className="brand-gradient grid size-10 place-items-center rounded-lg text-sm font-black text-white">다프</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--color-muted)]">학생</span> <span className="font-bold">{r.name as string}</span></div>
          <div><span className="text-[var(--color-muted)]">학번</span> <span className="font-semibold">{(r.student_code as string) ?? "—"}</span></div>
          <div><span className="text-[var(--color-muted)]">반</span> <span className="font-semibold">{r.class_name as string}</span></div>
          <div><span className="text-[var(--color-muted)]">시험</span> <span className="font-semibold">{r.title as string} ({r.date as string})</span></div>
        </div>

        <div className="mt-6 rounded-xl bg-[var(--color-soft)] p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">영역별 점수</p>
          <div className="space-y-2.5">
            {SECTIONS.map((s) => {
              const v = sections[s.key];
              const w = weights[s.key] || 1;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-semibold">{s.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white">
                    <div className="brand-gradient h-full rounded-full" style={{ width: `${Math.round(((v ?? 0) / w) * 100)}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums">{v ?? "—"}/{weights[s.key]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <p className="text-xs text-[var(--color-muted)]">총점</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{total} / 100</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <p className="text-xs text-[var(--color-muted)]">반 내 순위</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{rank ?? "—"} / {allRows.length}</p>
          </div>
        </div>

        {g && (
          <div className="mt-5 flex items-center justify-center">
            <div className={`rounded-full px-6 py-2 text-base font-bold ${GRADE_META[g].tone}`}>등급: {GRADE_META[g].dot} {GRADE_META[g].label}</div>
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">학부모 코멘트</p>
          <ExamCommentEditor examId={id} attemptId={attemptId} initial={(r.parent_comment as string) ?? ""} />
        </div>
      </div>
    </div>
  );
}
