import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

type Row = {
  id: string;
  title: string;
  lesson_range: string | null;
  class_name: string;
  status: string;
  questions: number;
  attempts: number;
};

const TONE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
};
const LABEL: Record<string, string> = { draft: "작성중", published: "게시됨", closed: "마감" };

export default async function ExamsPage() {
  const orgId = await getCurrentOrgId();
  const tests = (await sql`
    select t.id::text, t.title, t.lesson_range, c.name as class_name, t.status,
           (select count(*)::int from weekly_questions q where q.test_id = t.id) as questions,
           (select count(*)::int from weekly_results r where r.test_id = t.id) as attempts
    from weekly_tests t join classes c on c.id = t.class_id
    where t.organization_id = ${orgId}
    order by t.created_at desc
    limit 100
  `) as Row[];

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">주간 시험</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            듣기·읽기·쓰기·말하기 4영역(각 100점) 주간 복습 시험을 출제하고, 학생이 웹에서 응시·자동채점합니다.
          </p>
        </div>
        <Link href="/admin/exams/new" className="brand-gradient shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white">
          + 새 시험
        </Link>
      </div>

      {tests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">아직 시험이 없습니다. “새 시험”으로 출제를 시작하세요.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">시험</th>
                <th className="px-4 py-3 text-left font-bold">과범위</th>
                <th className="px-4 py-3 text-left font-bold">반</th>
                <th className="px-4 py-3 text-left font-bold">문항</th>
                <th className="px-4 py-3 text-left font-bold">응시</th>
                <th className="px-4 py-3 text-left font-bold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/admin/exams/${t.id}`} className="hover:text-[var(--color-primary)]">{t.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{t.lesson_range ?? "—"}</td>
                  <td className="px-4 py-3">{t.class_name}</td>
                  <td className="px-4 py-3 tabular-nums">{t.questions}</td>
                  <td className="px-4 py-3 tabular-nums">{t.attempts}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[t.status] ?? ""}`}>{LABEL[t.status] ?? t.status}</span>
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
