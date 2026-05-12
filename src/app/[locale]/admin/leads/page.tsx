import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { LeadRow } from "./lead-row";

type StatusKey = "new" | "contacted" | "enrolled" | "dropped";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.leads");
  const tStatus = await getTranslations("admin.leads.status");
  const tSource = await getTranslations("admin.leads.source");
  const tLevel = await getTranslations("admin.leads.level");
  const tTabs = await getTranslations("admin.leads.tabs");

  const sp = await searchParams;
  const filter = sp.status && ["new", "contacted", "enrolled", "dropped"].includes(sp.status)
    ? (sp.status as StatusKey)
    : null;
  const orgId = await getCurrentOrgId();

  const leads = (await sql`
    select id::text, name, phone, email,
           source, source_test_id::text,
           recommended_level::text as level,
           status, note,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from consult_leads
    where organization_id = ${orgId}
      ${filter ? sql`and status = ${filter}` : sql``}
    order by case status
      when 'new' then 1
      when 'contacted' then 2
      when 'enrolled' then 3
      when 'dropped' then 4
    end, created_at desc
  `) as Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    source_test_id: string | null;
    level: string | null;
    status: string;
    note: string | null;
    created_at: string;
  }>;

  const counts = (await sql`
    select status, count(*)::int as cnt
    from consult_leads
    where organization_id = ${orgId}
    group by status
  `) as { status: string; cnt: number }[];
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.cnt]));

  const tabs: { key: StatusKey | null; label: string; count: number }[] = [
    { key: null, label: tTabs("all"), count: counts.reduce((a, c) => a + c.cnt, 0) },
    { key: "new", label: tTabs("new"), count: countMap.new ?? 0 },
    { key: "contacted", label: tTabs("contacted"), count: countMap.contacted ?? 0 },
    { key: "enrolled", label: tTabs("enrolled"), count: countMap.enrolled ?? 0 },
    { key: "dropped", label: tTabs("dropped"), count: countMap.dropped ?? 0 },
  ];

  const statusLabel: Record<string, string> = {
    new: tStatus("new"),
    contacted: tStatus("contacted"),
    enrolled: tStatus("enrolled"),
    dropped: tStatus("dropped"),
  };
  const sourceLabel: Record<string, string> = {
    landing: tSource("landing"),
    pronunciation_test: tSource("pronunciation_test"),
    placement_test: tSource("placement_test"),
  };
  const levelLabel: Record<string, string> = {
    beginner: tLevel("beginner"),
    elementary: tLevel("elementary"),
    intermediate: tLevel("intermediate"),
    advanced: tLevel("advanced"),
  };

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {t("subtitle")}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const href = tab.key ? `?status=${tab.key}` : "?";
          const active = (filter ?? null) === tab.key;
          return (
            <a
              key={tab.key ?? "all"}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                active
                  ? "brand-gradient text-white"
                  : "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              {tab.label} <span className="opacity-70">{tab.count}</span>
            </a>
          );
        })}
      </div>

      {leads.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {filter ? t("emptyFiltered", { label: statusLabel[filter] }) : t("empty")}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {leads.map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              statusLabel={statusLabel}
              sourceLabel={sourceLabel}
              levelLabel={levelLabel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
