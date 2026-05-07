import { sql } from "@/lib/db/client";
import { LeadRow } from "./lead-row";

const STATUS_LABEL: Record<string, string> = {
  new: "신규",
  contacted: "연락 완료",
  enrolled: "등록 완료",
  dropped: "이탈",
};

const SOURCE_LABEL: Record<string, string> = {
  landing: "랜딩",
  pronunciation_test: "발음 테스트",
  placement_test: "레벨 테스트",
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.status && ["new", "contacted", "enrolled", "dropped"].includes(sp.status)
    ? sp.status
    : null;

  const leads = (await sql`
    select id::text, name, phone, email,
           source, source_test_id::text,
           recommended_level::text as level,
           status, note,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from consult_leads
    ${filter ? sql`where status = ${filter}` : sql``}
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
    group by status
  `) as { status: string; cnt: number }[];
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.cnt]));

  const tabs: { key: string | null; label: string; count: number }[] = [
    {
      key: null,
      label: "전체",
      count: counts.reduce((a, c) => a + c.cnt, 0),
    },
    { key: "new", label: STATUS_LABEL.new, count: countMap.new ?? 0 },
    { key: "contacted", label: STATUS_LABEL.contacted, count: countMap.contacted ?? 0 },
    { key: "enrolled", label: STATUS_LABEL.enrolled, count: countMap.enrolled ?? 0 },
    { key: "dropped", label: STATUS_LABEL.dropped, count: countMap.dropped ?? 0 },
  ];

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Leads
        </p>
        <h1 className="mt-1 text-2xl font-bold">상담 리드 파이프라인</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          상담 신청 → 연락 → 등록까지 전환 상태를 관리하세요.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const href = t.key ? `?status=${t.key}` : "?";
          const active = (filter ?? null) === t.key;
          return (
            <a
              key={t.key ?? "all"}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                active
                  ? "brand-gradient text-white"
                  : "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              {t.label} <span className="opacity-70">{t.count}</span>
            </a>
          );
        })}
      </div>

      {leads.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {filter ? `'${STATUS_LABEL[filter]}' 상태의 리드가 없어요.` : "아직 상담 신청이 없어요."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {leads.map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              statusLabel={STATUS_LABEL}
              sourceLabel={SOURCE_LABEL}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
