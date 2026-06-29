import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { Link } from "@/i18n/navigation";
import { NewRoundForm } from "./new-round-form";

export default async function NewRoundPage() {
  const orgId = await getCurrentOrgId();
  const classes = (await sql`
    select id::text, name from classes where organization_id = ${orgId} order by name
  `) as { id: string; name: string }[];

  // 발음·쓰기 과제 (연동 후보). class_id로 반별 필터링, 전체 대상(all)은 모든 반에서 선택 가능.
  const assignments = (await sql`
    select id::text, title, type::text as type, class_id::text, target_type,
           to_char(due_date, 'YYYY-MM-DD') as due_date
    from assignments
    where organization_id = ${orgId} and active = true and type in ('pronunciation', 'writing')
    order by coalesce(due_date, created_at::date) desc
    limit 200
  `) as {
    id: string;
    title: string;
    type: string;
    class_id: string | null;
    target_type: string;
    due_date: string | null;
  }[];

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/admin/assessments"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
      >
        ← 주말 평가 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">새 평가 회차</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        반과 평가일을 선택하고, 그 주 발음·쓰기 과제를 연결하면 점수가 자동으로 반영됩니다.
      </p>
      <div className="mt-6">
        <NewRoundForm classes={classes} assignments={assignments} />
      </div>
    </div>
  );
}
