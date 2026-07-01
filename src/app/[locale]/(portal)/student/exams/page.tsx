import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";

type Row = { id: string; title: string; lesson_range: string | null; class_name: string; status: string | null; average: number | null };

const ATT: Record<string, string> = {
  doing: "응시 중", submitted: "채점 중", waiting_writing_review: "채점 중", finalized: "완료",
};

export default async function StudentExamsPage() {
  const student = await requireStudent();
  const tests = (await sql`
    select t.id::text, t.title, t.lesson_range, c.name as class_name, r.status, r.average_score as average
    from weekly_tests t
    join classes c on c.id = t.class_id
    join students s on s.id = ${student.studentId}::uuid
    left join weekly_results r on r.test_id = t.id and r.student_id = ${student.studentId}::uuid
    where t.organization_id = ${student.organizationId} and t.status = 'published' and t.class_id = s.class_id
    order by t.created_at desc
  `) as Row[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">주간 시험</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">선생님이 출제한 주간 복습 시험(듣기·읽기·쓰기·말하기)을 응시하세요.</p>
      {tests.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-muted)]">아직 응시할 시험이 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tests.map((e) => {
            const done = e.status === "finalized";
            return (
              <li key={e.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{e.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{e.class_name}{e.lesson_range ? ` · ${e.lesson_range}과` : ""}{e.status ? ` · ${ATT[e.status] ?? e.status}` : ""}</p>
                  </div>
                  {done ? (
                    <Link href={`/student/exams/${e.id}/result`} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)]">결과 보기</Link>
                  ) : (
                    <Link href={`/student/exams/${e.id}`} className="brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white">{e.status ? "이어서 응시" : "응시하기"}</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
