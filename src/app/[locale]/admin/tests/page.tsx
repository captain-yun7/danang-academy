import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { AudioCell } from "./audio-cell";

type LevelKey = "beginner" | "elementary" | "intermediate" | "advanced";
type TypeKey = "free_pron" | "placement";
type StatusKey = "pending" | "processing" | "completed" | "failed";

const STATUS_TONE: Record<StatusKey, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

type UnifiedRow = {
  id: string;
  type: TypeKey;
  visitor_name: string;
  status: StatusKey;
  score: number | null;
  recommended_level: string | null;
  created_at: string;
  details: string | null;
};

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const t = await getTranslations("admin.tests");
  const tCol = await getTranslations("admin.tests.columns");
  const tTabs = await getTranslations("admin.tests.tabs");
  const tType = await getTranslations("admin.tests.type");
  const tStatus = await getTranslations("admin.tests.status");
  const tLevel = await getTranslations("admin.tests.level");

  const sp = await searchParams;
  const filter = sp.type === "free_pron" || sp.type === "placement" ? sp.type : null;
  const orgId = await getCurrentOrgId();

  const fpts = (await sql`
    select id::text, visitor_name, status::text, score,
           recommended_class_level::text as level,
           target_sentence,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from free_pronunciation_tests
    where organization_id = ${orgId}
    order by created_at desc
    limit 200
  `) as Array<{
    id: string;
    visitor_name: string;
    status: string;
    score: number | null;
    level: string | null;
    target_sentence: string;
    created_at: string;
  }>;

  const pts = (await sql`
    select id::text, visitor_name, status::text, mcq_score,
           recommended_level::text as level,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from placement_tests
    where organization_id = ${orgId}
    order by created_at desc
    limit 200
  `) as Array<{
    id: string;
    visitor_name: string;
    status: string;
    mcq_score: number;
    level: string | null;
    created_at: string;
  }>;

  const all: UnifiedRow[] = [
    ...fpts.map((r) => ({
      id: r.id,
      type: "free_pron" as const,
      visitor_name: r.visitor_name,
      status: r.status as StatusKey,
      score: r.score,
      recommended_level: r.level,
      created_at: r.created_at,
      details: r.target_sentence,
    })),
    ...pts.map((r) => ({
      id: r.id,
      type: "placement" as const,
      visitor_name: r.visitor_name,
      status: r.status as StatusKey,
      score: r.mcq_score,
      recommended_level: r.level,
      created_at: r.created_at,
      details: `MCQ ${r.mcq_score}/7`,
    })),
  ]
    .filter((r) => !filter || r.type === filter)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const tabs: { key: string | null; label: string; count: number }[] = [
    { key: null, label: tTabs("all"), count: fpts.length + pts.length },
    { key: "free_pron", label: tTabs("free_pron"), count: fpts.length },
    { key: "placement", label: tTabs("placement"), count: pts.length },
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t("subtitle")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const href = tab.key ? `?type=${tab.key}` : "?";
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

      {all.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">{t("empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">{tCol("type")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("name")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("status")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("score")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("recommended")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("details")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("audio")}</th>
                <th className="px-4 py-3 text-left font-bold">{tCol("time")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {all.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-xs font-bold">
                      {tType(r.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.visitor_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status]}`}
                    >
                      {tStatus(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{r.score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.recommended_level ? (
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs font-semibold">
                        {tLevel(r.recommended_level as LevelKey)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-[var(--color-muted)]">
                    {r.details}
                  </td>
                  <td className="px-4 py-3">
                    <AudioCell testId={r.id} type={r.type} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
