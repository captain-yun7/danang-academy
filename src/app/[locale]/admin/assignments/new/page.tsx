import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { AssignmentForm } from "../assignment-form";

export default async function NewAssignmentPage() {
  const t = await getTranslations("admin.assignments");
  const orgId = await getCurrentOrgId();
  const classes = (await sql`
    select id::text, name from classes
    where organization_id = ${orgId}
    order by name
  `) as { id: string; name: string }[];
  const students = (await sql`
    select s.id::text, s.name, s.student_code, c.name as class_name
    from students s
    left join classes c on c.id = s.class_id
    where s.organization_id = ${orgId}
    order by s.student_code nulls last, s.name
  `) as { id: string; name: string; student_code: string | null; class_name: string | null }[];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t("subtitle")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t("newTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("newDesc")}</p>

      <div className="mt-6 max-w-2xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <AssignmentForm
          mode="create"
          classes={classes}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            studentCode: s.student_code,
            className: s.class_name,
          }))}
        />
      </div>
    </div>
  );
}
