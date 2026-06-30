import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

type ExamRow = {
  id: string;
  title: string;
  class_name: string;
  date: string;
  status: string;
  questions: number;
  attempts: number;
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = { draft: "작성중", published: "게시됨", closed: "마감" };

export default async function ExamsPage() {
  const orgId = await getCurrentOrgId();
  const exams = (await sql`
    select e.id::text, e.title, c.name as class_name,
           to_char(e.exam_date, 'YYYY-MM-DD') as date, e.status,
           (select count(*)::int from exam_questions q where q.exam_id = e.id) as questions,
           (select count(*)::int from exam_attempts a where a.exam_id = e.id) as attempts
    from exams e join classes c on c.id = e.class_id
    where e.organization_id = ${orgId}
    order by e.exam_date desc, e.created_at desc
    limit 100
  `) as ExamRow[];

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">온라인 복습 시험</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            학생이 웹에서 직접 응시하고 자동 채점되는 금요일 종합 복습 시험을 출제·관리합니다.
          </p>
        </div>
        <Link
          href="/admin/exams/new"
          className="brand-gradient shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
        >
          + 새 시험
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">아직 시험이 없습니다. “새 시험”으로 출제를 시작하세요.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">시험</th>
                <th className="px-4 py-3 text-left font-bold">반</th>
                <th className="px-4 py-3 text-left font-bold">평가일</th>
                <th className="px-4 py-3 text-left font-bold">문항</th>
                <th className="px-4 py-3 text-left font-bold">응시</th>
                <th className="px-4 py-3 text-left font-bold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {exams.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/admin/exams/${e.id}`} className="hover:text-[var(--color-primary)]">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{e.class_name}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{e.date}</td>
                  <td className="px-4 py-3 tabular-nums">{e.questions}</td>
                  <td className="px-4 py-3 tabular-nums">{e.attempts}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[e.status] ?? ""}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
