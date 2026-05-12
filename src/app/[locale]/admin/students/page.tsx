import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { StudentFilters } from "./student-filters";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};
const LANG_LABEL: Record<string, string> = {
  vi: "🇻🇳 vi",
  en: "🇺🇸 en",
  other: "기타",
};
const STATUS_LABEL: Record<string, string> = {
  active: "수강중",
  paused: "휴학",
  graduated: "수료",
  dropped: "이탈",
};
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  graduated: "bg-blue-100 text-blue-700",
  dropped: "bg-gray-200 text-gray-600",
};

type Row = {
  id: string;
  name: string;
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
const ALLOWED_STATUSES = ["active", "paused", "graduated", "dropped"] as const;

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; class?: string; level?: string }>;
}) {
  const sp = await searchParams;
  const orgId = await getCurrentOrgId();
  const q = (sp.q ?? "").trim();
  const status =
    sp.status && ALLOWED_STATUSES.includes(sp.status as (typeof ALLOWED_STATUSES)[number])
      ? sp.status
      : null;
  const level =
    sp.level && ALLOWED_LEVELS.includes(sp.level as (typeof ALLOWED_LEVELS)[number])
      ? sp.level
      : null;
  const classFilter = sp.class && sp.class.length > 0 ? sp.class : null;

  const qLike = q ? `%${q}%` : null;

  const students = (await sql`
    select s.id::text, s.name, s.phone,
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
      ${qLike ? sql`and (s.name ilike ${qLike} or coalesce(s.phone, '') ilike ${qLike})` : sql``}
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
            Students
          </p>
          <h1 className="mt-1 text-2xl font-bold">학생 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            전체 {total}명 · 수강중 {countMap.active ?? 0} / 휴학 {countMap.paused ?? 0} / 수료 {countMap.graduated ?? 0} / 이탈 {countMap.dropped ?? 0}
          </p>
        </div>
        <Link
          href="/admin/students/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          + 새 학생 등록
        </Link>
      </div>

      <StudentFilters classes={classes} initial={{ q, status, level, classFilter }} />

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        결과: {students.length}명
      </p>

      {students.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {q || status || level || classFilter
              ? "조건에 맞는 학생이 없어요. 필터를 조정해보세요."
              : "아직 등록된 학생이 없어요."}
          </p>
          {!q && !status && !level && !classFilter && (
            <Link
              href="/admin/students/new"
              className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
            >
              첫 학생 등록하기 →
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">이름</th>
                <th className="px-4 py-3 text-left font-bold">상태</th>
                <th className="px-4 py-3 text-left font-bold">연락처</th>
                <th className="px-4 py-3 text-left font-bold">레벨</th>
                <th className="px-4 py-3 text-left font-bold">반</th>
                <th className="px-4 py-3 text-left font-bold">모국어</th>
                <th className="px-4 py-3 text-left font-bold">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {students.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-[var(--color-soft)]/40 ${
                    s.status !== "active" ? "opacity-60" : ""
                  }`}
                >
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
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.korean_level ? (
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-xs font-semibold">
                        {LEVEL_LABEL[s.korean_level]}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{s.class_name ?? "미배정"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {LANG_LABEL[s.native_language] ?? s.native_language}
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
