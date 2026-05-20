import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { ToggleActive } from "./toggle-active";

type Row = {
  id: string;
  slug: string;
  title_ko: string;
  title_vi: string;
  level_label_ko: string;
  sessions: number;
  rating: string;
  sort_order: number;
  active: boolean;
};

export default async function AdminCoursesPage() {
  const t = await getTranslations("admin.courses");
  const orgId = await getCurrentOrgId();
  const rows = (await sql`
    select id::text, slug, title_ko, title_vi, level_label_ko,
           sessions, rating::text, sort_order, active
    from course_catalog
    where organization_id = ${orgId}
    order by sort_order, created_at
  `) as Row[];

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("subtitle")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t("summary", { total: rows.length, active: activeCount })}
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          {t("newButton")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">{t("empty")}</p>
          <Link
            href="/admin/courses/new"
            className="mt-3 inline-block text-sm font-bold text-[var(--color-primary-deep)] hover:underline"
          >
            {t("emptyAction")} →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-soft)] text-left text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">{t("columns.sort")}</th>
                <th className="px-4 py-3">{t("columns.slug")}</th>
                <th className="px-4 py-3">{t("columns.title")}</th>
                <th className="px-4 py-3">{t("columns.level")}</th>
                <th className="px-4 py-3 text-right">{t("columns.rating")}</th>
                <th className="px-4 py-3 text-right">{t("columns.sessions")}</th>
                <th className="px-4 py-3 text-center">{t("columns.active")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3 font-bold text-[var(--color-muted)]">{r.sort_order}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.slug}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{r.title_ko}</div>
                    <div className="text-xs text-[var(--color-muted)]">{r.title_vi}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.level_label_ko}</td>
                  <td className="px-4 py-3 text-right">★ {Number(r.rating).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">{r.sessions}</td>
                  <td className="px-4 py-3 text-center">
                    <ToggleActive id={r.id} active={r.active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/courses/${r.id}`}
                      className="text-xs font-bold text-[var(--color-primary-deep)] hover:underline"
                    >
                      {t("edit")} →
                    </Link>
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
