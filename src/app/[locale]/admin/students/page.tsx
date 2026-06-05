import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { StudentFilters } from "./student-filters";

const STATUS_TONE: Record<string, string> = {
  waiting: "bg-violet-100 text-violet-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  graduated: "bg-blue-100 text-blue-700",
  dropped: "bg-gray-200 text-gray-600",
};

type Row = {
  id: string;
  name: string;
  student_code: string | null;
  phone: string | null;
  native_language: string;
  korean_level: string | null;
  class_id: string | null;
  class_name: string | null;
  enrolled_at: string | null;
  qr_token: string;
  status: string;
  created_at: string;
};

const ALLOWED_LEVELS = ["beginner", "elementary", "intermediate", "advanced"] as const;
const ALLOWED_STATUSES = ["waiting", "active", "paused", "graduated", "dropped"] as const;
type LevelKey = (typeof ALLOWED_LEVELS)[number];
type StatusKey = (typeof ALLOWED_STATUSES)[number];

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; class?: string; level?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("admin.students");
  const tCols = await getTranslations("admin.students.columns");
  const tStatus = await getTranslations("admin.students.status");
  const tLevel = await getTranslations("admin.students.level");
  const tLang = await getTranslations("admin.students.languages");

  const orgId = await getCurrentOrgId();
  const q = (sp.q ?? "").trim();
  const status =
    sp.status && ALLOWED_STATUSES.includes(sp.status as StatusKey) ? sp.status : null;
  const level =
    sp.level && ALLOWED_LEVELS.includes(sp.level as LevelKey) ? sp.level : null;
  const classFilter = sp.class && sp.class.length > 0 ? sp.class : null;

  const qLike = q ? `%${q}%` : null;

  const students = (await sql`
    select s.id::text, s.name, s.student_code, s.phone,
           s.native_language::text,
           s.korean_level::text,
           s.class_id::text,
           c.name as class_name,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           s.qr_token,
           s.status::text,
           to_char(s.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as created_at
    from students s
    left join classes c on c.id = s.class_id
    where s.organization_id = ${orgId}
      ${qLike ? sql`and (s.name ilike ${qLike} or coalesce(s.phone, '') ilike ${qLike} or coalesce(s.student_code, '') ilike ${qLike})` : sql``}
      ${status ? sql`and s.status = ${status}::student_status` : sql``}
      ${level ? sql`and s.korean_level = ${level}::korean_level` : sql``}
      ${classFilter === "none" ? sql`and s.class_id is null` : classFilter ? sql`and s.class_id = ${classFilter}::uuid` : sql``}
    order by s.created_at desc
  `) as Row[];

  const classes = (await sql`
    select id::text, name from classes
    where organization_id = ${orgId}
    order by name
  `) as { id: string; name: string }[];

  const counts = (await sql`
    select status::text, count(*)::int as cnt
    from students
    where organization_id = ${orgId}
    group by status
  `) as { status: string; cnt: number }[];
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.cnt]));
  const total = counts.reduce((a, c) => a + c.cnt, 0);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("subtitle")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t("totalSummary", {
              total,
              waiting: countMap.waiting ?? 0,
              active: countMap.active ?? 0,
              paused: countMap.paused ?? 0,
              graduated: countMap.graduated ?? 0,
              dropped: countMap.dropped ?? 0,
            })}
          </p>
        </div>
        <Link
          href="/admin/students/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          {t("newButton")}
        </Link>
      </div>

      <StudentFilters classes={classes} initial={{ q, status, level, classFilter }} />

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        {t("resultCount", { count: students.length })}
      </p>

      {students.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {q || status || level || classFilter ? t("noResults") : t("emptyState")}
          </p>
          {!q && !status && !level && !classFilter && (
            <Link
              href="/admin/students/new"
              className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
            >
              {t("emptyAction")}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">{tCols("studentCode")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("name")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("status")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("phone")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("level")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("class")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("language")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCols("enrolledDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {students.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-[var(--color-soft)]/40 ${
                    s.status !== "active" && s.status !== "waiting" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    {s.student_code ? (
                      <span className="rounded bg-[var(--color-soft)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-ink)]">
                        {s.student_code}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="hover:text-[var(--color-primary-deep)]"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}
                    >
                      {tStatus(s.status as StatusKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.korean_level ? (
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-xs font-semibold">
                        {tLevel(s.korean_level as LevelKey)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {s.class_name ?? t("filters.unassigned")}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {tLang(s.native_language as "vi" | "en" | "other")}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {s.enrolled_at ?? s.created_at}
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
