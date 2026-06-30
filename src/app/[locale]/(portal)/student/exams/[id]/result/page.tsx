import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SECTIONS, grade, GRADE_META, DEFAULT_CUTS, type GradeCuts, type Section } from "@/lib/exams/scoring";

export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await requireStudent();

  const rows = (await sql`
    select e.title, to_char(e.exam_date,'YYYY-MM-DD') as date,
           a.status, a.total_score,
           a.listening_score, a.reading_score, a.grammar_vocab_score, a.writing_score, a.speaking_score,
           e.w_listening, e.w_reading, e.w_grammar, e.w_writing, e.w_speaking
    from exams e
    join exam_attempts a on a.exam_id = e.id and a.student_id = ${student.studentId}::uuid
    where e.id = ${id}::uuid and e.organization_id = ${student.organizationId}
    limit 1
  `) as Array<Record<string, number | string | null>>;
  if (!rows[0]) notFound();
  const r = rows[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${student.organizationId} limit 1
  `) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  const grading = r.status !== "completed";
  const total = (r.total_score as number) ?? 0;
  const g = grade(total, cuts);

  const sectionVal: Record<Section, number | null> = {
    listening: r.listening_score as number | null,
    reading: r.reading_score as number | null,
    grammar_vocab: r.grammar_vocab_score as number | null,
    writing: r.writing_score as number | null,
    speaking: r.speaking_score as number | null,
  };
  const weightVal: Record<Section, number> = {
    listening: r.w_listening as number,
    reading: r.w_reading as number,
    grammar_vocab: r.w_grammar as number,
    writing: r.w_writing as number,
    speaking: r.w_speaking as number,
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/student/exams" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">
        ← 복습 시험 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{r.title as string}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{r.date as string}</p>

      {grading && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          채점이 진행 중입니다. 말하기 자동 채점이 끝나면 최종 점수가 표시됩니다.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-white p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">총점</p>
        <p className="mt-1 text-4xl font-black">{total}<span className="text-lg font-normal text-[var(--color-muted)]">/100</span></p>
        {g && (
          <div className={`mt-3 inline-block rounded-full px-5 py-1.5 text-sm font-bold ${GRADE_META[g].tone}`}>
            {GRADE_META[g].dot} {GRADE_META[g].label}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {SECTIONS.map((s) => (
          <div key={s.key} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
            <span className="font-semibold">{s.label}</span>
            <span className="tabular-nums">
              {sectionVal[s.key] ?? "—"} <span className="text-[var(--color-muted)]">/ {weightVal[s.key]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
