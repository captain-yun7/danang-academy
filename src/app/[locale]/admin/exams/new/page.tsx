import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { Link } from "@/i18n/navigation";
import { NewTestForm } from "./new-exam-form";

export default async function NewTestPage() {
  const orgId = await getCurrentOrgId();
  const classes = (await sql`
    select id::text, name from classes where organization_id = ${orgId} order by name
  `) as { id: string; name: string }[];
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/exams" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">
        ← 주간 시험 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">새 시험</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">반과 과범위를 정하면, 다음 화면에서 4영역 문항을 출제합니다.</p>
      <div className="mt-6">
        <NewTestForm classes={classes} />
      </div>
    </div>
  );
}
