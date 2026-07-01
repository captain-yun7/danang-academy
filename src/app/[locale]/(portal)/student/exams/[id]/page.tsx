import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SKILLS } from "@/lib/exams/scoring";
import { StartButton } from "./start-button";

export default async function TestIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await requireStudent();
  const rows = (await sql`
    select t.id::text, t.title, t.lesson_range, c.name as class_name, r.status
    from weekly_tests t
    join classes c on c.id = t.class_id
    join students s on s.id = ${student.studentId}::uuid
    left join weekly_results r on r.test_id = t.id and r.student_id = ${student.studentId}::uuid
    where t.id = ${id}::uuid and t.organization_id = ${student.organizationId}
      and t.status = 'published' and t.class_id = s.class_id limit 1
  `) as { id: string; title: string; lesson_range: string | null; class_name: string; status: string | null }[];
  if (!rows[0]) notFound();
  const t = rows[0];
  if (t.status === "finalized") redirect(`/student/exams/${id}/result`);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t.class_name}{t.lesson_range ? ` · ${t.lesson_range}과` : ""}</p>
      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <p className="text-sm font-bold">시험 구성 (각 100점, 총 400점)</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {SKILLS.map((s) => <li key={s.key} className="rounded-lg bg-[var(--color-soft)] px-3 py-2 font-semibold">{s.label} 100점</li>)}
        </ul>
        <p className="mt-4 text-xs text-[var(--color-muted)]">영역별로 순서대로 응시합니다. 중간에 나가도 이어서 응시할 수 있습니다.</p>
      </div>
      <div className="mt-6"><StartButton testId={id} resume={!!t.status && t.status !== "finalized"} /></div>
    </div>
  );
}
