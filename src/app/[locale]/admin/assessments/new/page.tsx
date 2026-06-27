import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { Link } from "@/i18n/navigation";
import { NewRoundForm } from "./new-round-form";

export default async function NewRoundPage() {
  const orgId = await getCurrentOrgId();
  const classes = (await sql`
    select id::text, name from classes where organization_id = ${orgId} order by name
  `) as { id: string; name: string }[];

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
        반과 평가일을 선택하면 해당 반 학생들의 점수를 입력할 수 있습니다.
      </p>
      <div className="mt-6">
        <NewRoundForm classes={classes} />
      </div>
    </div>
  );
}
