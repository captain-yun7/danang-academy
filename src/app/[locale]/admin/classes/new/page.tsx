import { sql } from "@/lib/db/client";
import { ClassForm } from "../class-form";

export default async function NewClassPage() {
  const teachers = (await sql`
    select id::text, name from users
    where role in ('teacher','manager','owner','super_admin')
    order by name
  `) as { id: string; name: string }[];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Classes
      </p>
      <h1 className="mt-1 text-2xl font-bold">새 반 개설</h1>

      <div className="mt-6 max-w-xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <ClassForm mode="create" teachers={teachers} />
      </div>
    </div>
  );
}
