import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { StudentForm } from "../student-form";

export default async function NewStudentPage() {
  const t = await getTranslations("admin.students");
  const orgId = await getCurrentOrgId();
  const classes = (await sql`
    select id::text, name, level::text from classes
    where organization_id = ${orgId}
    order by name
  `) as { id: string; name: string; level: string }[];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t("subtitle")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t("newTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("newDesc")}</p>

      <div className="mt-6 max-w-xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <StudentForm mode="create" classes={classes} />
      </div>
    </div>
  );
}
