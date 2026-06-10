import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

type Row = {
  id: string;
  type: string;
  title: string;
  target_type: string;
  class_name: string | null;
  target_count: number;
  due_date: string | null;
  tts_status: string | null;
  step_count: number;
  step_tts_status: string | null;
  active: boolean;
  created_at: string;
  submission_count: number;
  done_count: number;
};

const TYPE_TONE: Record<string, string> = {
  pronunciation: "bg-indigo-100 text-indigo-700",
  writing: "bg-amber-100 text-amber-700",
  listening: "bg-sky-100 text-sky-700",
};

export default async function AdminAssignmentsPage() {
  const t = await getTranslations("admin.assignments");
  const tType = await getTranslations("admin.assignments.types");
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select a.id::text, a.type::text, a.title, a.target_type,
           c.name as class_name,
           (select count(*)::int from assignment_targets t where t.assignment_id = a.id) as target_count,
           to_char(a.due_date, 'YYYY-MM-DD') as due_date,
           a.tts_status,
           (select count(*)::int from assignment_steps st where st.assignment_id = a.id) as step_count,
           (select case
              when bool_or(item->>'ttsStatus' = 'failed') then 'failed'
              when bool_or(item->>'ttsStatus' = 'pending') then 'pending'
              else 'ready' end
            from assignment_steps st, jsonb_array_elements(st.items) item
            where st.assignment_id = a.id) as step_tts_status,
           a.active,
           to_char(a.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as created_at,
           (select count(*)::int from assignment_submissions s where s.assignment_id = a.id) as submission_count,
           (select count(*)::int from assignment_submissions s where s.assignment_id = a.id and s.status in ('completed','graded')) as done_count
    from assignments a
    left join classes c on c.id = a.class_id
    where a.organization_id = ${orgId}
    order by a.created_at desc
  `) as Row[];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("subtitle")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>
        </div>
        <Link
          href="/admin/assignments/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          {t("newButton")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">{t("empty")}</p>
          <Link
            href="/admin/assignments/new"
            className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
          >
            {t("emptyAction")}
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">{t("cols.title")}</th>
                <th className="px-4 py-3 text-left font-bold">{t("cols.type")}</th>
                <th className="px-4 py-3 text-left font-bold">{t("cols.class")}</th>
                <th className="px-4 py-3 text-left font-bold">{t("cols.due")}</th>
                <th className="px-4 py-3 text-left font-bold">{t("cols.submissions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {rows.map((a) => {
                // 단계형은 항목 jsonb 집계 상태, 단일형은 과제 tts_status
                const ttsStatus = a.step_count > 0 ? a.step_tts_status : a.tts_status;
                return (
                <tr key={a.id} className={`hover:bg-[var(--color-soft)]/40 ${a.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/admin/assignments/${a.id}`}
                      className="hover:text-[var(--color-primary-deep)]"
                    >
                      {a.title}
                    </Link>
                    {(a.type === "pronunciation" || a.type === "listening") &&
                      ttsStatus &&
                      ttsStatus !== "ready" && (
                        <span className="ml-2 align-middle text-[11px] text-[var(--color-muted)]">
                          {ttsStatus === "pending" ? t("ttsPending") : t("ttsFailed")}
                        </span>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_TONE[a.type]}`}>
                      {tType(a.type)}
                    </span>
                    {a.step_count > 0 && (
                      <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        {t("stepBadge")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {a.target_type === "class"
                      ? a.class_name ?? t("allClasses")
                      : a.target_type === "students"
                        ? t("individualCount", { count: a.target_count })
                        : t("allClasses")}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{a.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {a.done_count} / {a.submission_count}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
