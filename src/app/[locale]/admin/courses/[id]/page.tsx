import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { CourseForm } from "../course-form";

type Row = {
  id: string;
  slug: string;
  title_ko: string;
  title_vi: string;
  level_label_ko: string;
  level_label_vi: string;
  desc_ko: string;
  desc_vi: string;
  rating: string;
  sessions: number;
  sort_order: number;
  active: boolean;
};

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.courses");
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select id::text, slug, title_ko, title_vi,
           level_label_ko, level_label_vi, desc_ko, desc_vi,
           rating::text, sessions, sort_order, active
    from course_catalog
    where id = ${id} and organization_id = ${orgId}
    limit 1
  `) as Row[];
  const row = rows[0];
  if (!row) notFound();

  return (
    <div>
      <Link
        href="/admin/courses"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {t("backToList")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("editTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)] font-mono">{row.slug}</p>

      <div className="mt-6 max-w-3xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <CourseForm
          initial={{
            id: row.id,
            slug: row.slug,
            titleKo: row.title_ko,
            titleVi: row.title_vi,
            levelLabelKo: row.level_label_ko,
            levelLabelVi: row.level_label_vi,
            descKo: row.desc_ko,
            descVi: row.desc_vi,
            rating: Number(row.rating),
            sessions: row.sessions,
            sortOrder: row.sort_order,
            active: row.active,
          }}
        />
      </div>
    </div>
  );
}
