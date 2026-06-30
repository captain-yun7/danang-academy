import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";

type Row = {
  id: string;
  title: string;
  class_name: string;
  date: string;
  attempt_status: string | null;
  total_score: number | null;
};

const ATT_LABEL: Record<string, string> = {
  in_progress: "응시 중",
  submitted: "채점 중",
  completed: "완료",
};

export default async function StudentExamsPage() {
  const student = await requireStudent();
  const exams = (await sql`
    select e.id::text, e.title, c.name as class_name,
           to_char(e.exam_date, 'YYYY-MM-DD') as date,
           a.status as attempt_status, a.total_score
    from exams e
    join classes c on c.id = e.class_id
    join students s on s.id = ${student.studentId}::uuid
    left join exam_attempts a on a.exam_id = e.id and a.student_id = ${student.studentId}::uuid
    where e.organization_id = ${student.organizationId}
      and e.status = 'published' and e.class_id = s.class_id
    order by e.exam_date desc
  `) as Row[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">복습 시험</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">선생님이 출제한 주간 복습 시험을 응시하세요.</p>

      {exams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-muted)]">
          아직 응시할 시험이 없습니다.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {exams.map((e) => {
            const done = e.attempt_status === "completed";
            return (
              <li key={e.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{e.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {e.class_name} · {e.date}
                      {e.attempt_status && <> · {ATT_LABEL[e.attempt_status] ?? e.attempt_status}</>}
                    </p>
                  </div>
                  {done ? (
                    <Link
                      href={`/student/exams/${e.id}/result`}
                      className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    >
                      결과 보기
                    </Link>
                  ) : (
                    <Link
                      href={`/student/exams/${e.id}`}
                      className="brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white"
                    >
                      {e.attempt_status ? "이어서 응시" : "응시하기"}
                    </Link>
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
