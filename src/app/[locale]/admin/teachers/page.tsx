import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { TeacherForm } from "./teacher-form";
import { TeacherRow } from "./teacher-row";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "슈퍼관리자",
  owner: "원장",
  manager: "매니저",
  teacher: "강사",
};

const ROLE_TONE: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  owner: "bg-rose-100 text-rose-700",
  manager: "bg-blue-100 text-blue-700",
  teacher: "bg-emerald-100 text-emerald-700",
};

export default async function AdminTeachersPage() {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role ?? "teacher";
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const orgId = await getCurrentOrgId();

  const users = (await sql`
    select u.id::text, u.email, u.name, u.phone, u.role::text,
           to_char(u.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as joined,
           (select count(*)::int from classes c where c.teacher_id = u.id) as class_count
    from users u
    where u.organization_id = ${orgId}
    order by case u.role
      when 'super_admin' then 1
      when 'owner' then 2
      when 'manager' then 3
      when 'teacher' then 4
      else 5
    end, u.created_at desc
  `) as Array<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    joined: string;
    class_count: number;
  }>;

  const canManage = ["manager", "owner", "super_admin"].includes(sessionRole);
  const canRoleEdit = ["owner", "super_admin"].includes(sessionRole);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Teachers · Staff
          </p>
          <h1 className="mt-1 text-2xl font-bold">강사·직원 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            총 {users.length}명. 강사가 본인 폰으로 출석 체크하려면 여기서 계정을 만들어주세요.
          </p>
        </div>
      </div>

      {canManage && (
        <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">새 직원 추가</h2>
          <TeacherForm sessionRole={sessionRole} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">직원 목록</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">이름</th>
                <th className="px-4 py-3 text-left font-bold">역할</th>
                <th className="px-4 py-3 text-left font-bold">이메일</th>
                <th className="px-4 py-3 text-left font-bold">연락처</th>
                <th className="px-4 py-3 text-left font-bold">담당 반</th>
                <th className="px-4 py-3 text-left font-bold">가입일</th>
                <th className="px-4 py-3 text-right font-bold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {users.map((u) => (
                <TeacherRow
                  key={u.id}
                  user={u}
                  sessionUserId={sessionUserId}
                  canManage={canManage}
                  canRoleEdit={canRoleEdit}
                  roleLabel={ROLE_LABEL}
                  roleTone={ROLE_TONE}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
