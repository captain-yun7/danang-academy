import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SKILLS, grade, GRADE_META, DEFAULT_CUTS, type GradeCuts, type Skill } from "@/lib/exams/scoring";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await requireStudent();
  const rows = (await sql`
    select t.title, t.lesson_range, r.status, r.total_score, r.average_score,
           r.listening_score, r.reading_score, r.writing_final_score, r.speaking_score, r.teacher_comment
    from weekly_tests t
    join weekly_results r on r.test_id = t.id and r.student_id = ${student.studentId}::uuid
    where t.id = ${id}::uuid and t.organization_id = ${student.organizationId} limit 1
  `) as Array<Record<string, number | string | null>>;
  if (!rows[0]) notFound();
  const r = rows[0];
  const cutRows = (await sql`select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal from organizations where id = ${student.organizationId} limit 1`) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  const grading = r.status !== "finalized";
  const avg = Number(r.average_score ?? 0);
  const g = grade(avg, cuts);
  const skillVal: Record<Skill, number | null> = {
    listening: r.listening_score as number | null, reading: r.reading_score as number | null,
    writing: r.writing_final_score as number | null, speaking: r.speaking_score as number | null,
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/student/exams" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">← 주간 시험 목록</Link>
      <h1 className="mt-2 text-2xl font-bold">{r.title as string}</h1>
      {grading && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">채점이 진행 중입니다. 말하기 자동채점·쓰기 교사 확인이 끝나면 최종 점수가 표시됩니다.</p>}
      <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-white p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">평균</p>
        <p className="mt-1 text-4xl font-black">{avg}<span className="text-lg font-normal text-[var(--color-muted)]">/100</span></p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">총점 {(r.total_score as number) ?? 0}/400</p>
        {g && <div className={`mt-3 inline-block rounded-full px-5 py-1.5 text-sm font-bold ${GRADE_META[g].tone}`}>{GRADE_META[g].dot} {GRADE_META[g].label}</div>}
      </div>
      <div className="mt-5 space-y-2">
        {SKILLS.map((s) => (
          <div key={s.key} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
            <span className="font-semibold">{s.label}</span>
            <span className="tabular-nums">{skillVal[s.key] ?? "—"} <span className="text-[var(--color-muted)]">/ 100</span></span>
          </div>
        ))}
      </div>
      {r.teacher_comment && (
        <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">선생님 코멘트</p>
          <p className="mt-1 text-sm leading-relaxed">{r.teacher_comment as string}</p>
        </div>
      )}
    </div>
  );
}
