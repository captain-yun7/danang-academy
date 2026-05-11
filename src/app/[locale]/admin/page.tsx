import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문반",
  elementary: "초급반",
  intermediate: "중급반",
  advanced: "고급반",
};

async function loadKpis(orgId: string) {
  const rows = (await sql`
    select
      (select count(*)::int from students where organization_id = ${orgId}) as total_students,
      (select count(*)::int from classes where organization_id = ${orgId}) as total_classes,
      (select count(*)::int from free_pronunciation_tests
         where organization_id = ${orgId}
           and created_at >= now() - interval '7 days') as tests_week,
      (select coalesce(round(avg(score))::int, 0) from (
         select score from free_pronunciation_tests
         where organization_id = ${orgId} and status='completed' and score is not null
         order by created_at desc limit 100
      ) recent) as avg_score,
      (select count(*)::int from consult_leads where organization_id = ${orgId}) as total_leads,
      (select count(*)::int from consult_leads
         where organization_id = ${orgId}
           and source in ('pronunciation_test','placement_test')) as test_to_lead,
      (select count(distinct student_id)::int from attendance_logs
         where organization_id = ${orgId}
           and kind='check_in'
           and logged_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
           and logged_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
      ) as today_checkins
  `) as Array<{
    total_students: number;
    total_classes: number;
    tests_week: number;
    avg_score: number;
    total_leads: number;
    test_to_lead: number;
    today_checkins: number;
  }>;

  const r = rows[0];
  const attendancePct = r.total_students > 0
    ? Math.round((r.today_checkins / r.total_students) * 100)
    : 0;
  const conversionPct = r.tests_week > 0
    ? Math.round((r.test_to_lead / Math.max(r.tests_week, 1)) * 100)
    : 0;

  return {
    students: r.total_students.toString(),
    attendance: `${attendancePct}%`,
    tests: r.tests_week.toString(),
    leads: `${conversionPct}%`,
    score: r.avg_score.toString(),
    classes: r.total_classes.toString(),
    todayCheckins: r.today_checkins,
    totalLeads: r.total_leads,
  };
}

async function loadRecentLeads(orgId: string) {
  return (await sql`
    select id::text, name, phone,
           recommended_level::text as level,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date,
           source, status
    from consult_leads
    where organization_id = ${orgId}
    order by created_at desc
    limit 5
  `) as Array<{
    id: string;
    name: string;
    phone: string | null;
    level: string | null;
    date: string;
    source: string | null;
    status: string;
  }>;
}

async function loadTodayClasses(orgId: string) {
  return (await sql`
    select c.id::text, c.name, c.level::text, c.schedule, c.capacity,
           u.name as teacher_name,
           (select count(*)::int from students s where s.class_id = c.id) as student_count
    from classes c
    left join users u on u.id = c.teacher_id
    where c.organization_id = ${orgId}
    order by c.created_at desc
    limit 5
  `) as Array<{
    id: string;
    name: string;
    level: string;
    schedule: string | null;
    capacity: number;
    teacher_name: string | null;
    student_count: number;
  }>;
}

const KPI_ORDER = ["students", "attendance", "tests", "leads", "score", "classes"] as const;

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const orgId = await getCurrentOrgId();

  const [kpis, recentLeads, todayClasses] = await Promise.all([
    loadKpis(orgId),
    loadRecentLeads(orgId),
    loadTodayClasses(orgId),
  ]);

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t("subtitle", { date: today })}
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
        {KPI_ORDER.map((k) => (
          <div
            key={k}
            className="rounded-lg border border-[var(--color-line)] bg-white p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {t(`kpi.${k}`)}
            </p>
            <p className="mt-2 text-3xl font-black">{kpis[k]}</p>
            <p className="mt-1 text-xs text-[var(--color-primary-deep)]">
              {kpiSub(k, kpis)}
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
          {recentLeads.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">
              아직 상담 신청이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] text-sm">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{l.phone ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    {l.level && (
                      <span className="rounded-full bg-[var(--color-primary)]/40 px-2.5 py-0.5 text-xs font-semibold">
                        {LEVEL_LABEL[l.level] ?? l.level}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{l.date}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-line)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">{t("classesTitle")}</h2>
            <Link
              href="/admin/classes"
              className="text-xs font-semibold text-[var(--color-primary-deep)] hover:underline"
            >
              {t("viewAll")} →
            </Link>
          </div>
          {todayClasses.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-md bg-[var(--color-soft)] text-sm text-[var(--color-muted)]">
              아직 개설된 반이 없어요.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] text-sm">
              {todayClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {LEVEL_LABEL[c.level] ?? c.level}
                      {c.schedule ? ` · ${c.schedule}` : ""}
                      {c.teacher_name ? ` · ${c.teacher_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">
                      {c.student_count} / {c.capacity}
                    </p>
                    <p className="text-[var(--color-muted)]">학생</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function kpiSub(
  k: (typeof KPI_ORDER)[number],
  kpis: { todayCheckins: number; totalLeads: number }
) {
  switch (k) {
    case "students":
      return "전체 등록";
    case "attendance":
      return `오늘 ${kpis.todayCheckins}명 입실`;
    case "tests":
      return "최근 7일";
    case "leads":
      return `누적 ${kpis.totalLeads}건`;
    case "score":
      return "최근 100건";
    case "classes":
      return "운영 중";
  }
}
