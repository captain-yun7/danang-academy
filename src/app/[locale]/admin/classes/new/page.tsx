import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { ClassForm } from "../class-form";

export default async function NewClassPage() {
  const t = await getTranslations("admin.classes");
  const orgId = await getCurrentOrgId();
  const teachers = (await sql`
    select id::text, name from users
    where organization_id = ${orgId}
      and role in ('teacher','manager','owner','super_admin')
    order by name
  `) as { id: string; name: string }[];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t("subtitle")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t("newTitle")}</h1>

      <div className="mt-6 max-w-xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <ClassForm mode="create" teachers={teachers} />
      </div>
    </div>
  );
}
