import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const kpiKeys = ["students", "attendance", "tests", "leads", "score", "classes"] as const;

const kpiValues: Record<(typeof kpiKeys)[number], string> = {
  students: "184",
  attendance: "92%",
  tests: "48",
  leads: "37%",
  score: "81",
  classes: "12",
};

const recentLeads = [
  { name: "Nguyễn Thu Hà", phone: "+84 ••• ••• •123", levelKey: "beginner", date: "2026-04-22" },
  { name: "Trần Văn Đức", phone: "+84 ••• ••• •456", levelKey: "intermediate", date: "2026-04-22" },
  { name: "Phạm Minh Châu", phone: "+84 ••• ••• •789", levelKey: "advanced", date: "2026-04-21" },
];

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const tLevels = await getTranslations("levels");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t("subtitle", { date: "2026-04-24" })}
          </p>
        </div>
        <Link
          href="/admin/tests"
          className="hidden rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-deep)] sm:inline-flex"
        >
          {t("recent")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiKeys.map((k) => (
          <div
            key={k}
            className="rounded-lg border border-[var(--color-line)] bg-white p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {t(`kpi.${k}`)}
            </p>
            <p className="mt-2 text-3xl font-black">{kpiValues[k]}</p>
            <p className="mt-1 text-xs text-[var(--color-primary-deep)]">
              {t(`kpi.${k}Sub`)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--color-line)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">{t("leadsTitle")}</h2>
            <Link
              href="/admin/leads"
              className="text-xs font-semibold text-[var(--color-primary-deep)] hover:underline"
            >
              {t("viewAll")} →
            </Link>
          </div>
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {recentLeads.map((l) => (
              <li key={l.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{l.phone}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[var(--color-primary)]/40 px-2.5 py-0.5 text-xs font-semibold">
                    {tLevels(l.levelKey)}
                  </span>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{l.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--color-line)] p-5">
          <h2 className="mb-3 text-base font-bold">{t("classesTitle")}</h2>
          <div className="flex h-40 items-center justify-center rounded-md bg-[var(--color-soft)] text-sm text-[var(--color-muted)]">
            {t("classesPlaceholder")}
          </div>
        </section>
      </div>

      <p className="mt-8 text-xs text-[var(--color-muted)]">{t("sampleNote")}</p>
    </div>
  );
}
