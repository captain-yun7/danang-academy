import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { AttendanceBoard } from "./attendance-board";
import { SessionStatusEditor } from "./status-editor";

type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const locale = await getLocale();

  const dateFormat = locale === "vi"
    ? '"Ngày" DD "tháng" MM "năm" YYYY (Dy)'
    : 'YYYY"년" MM"월" DD"일" (Dy)';

  const rows = (await sql`
    select cs.id::text, cs.class_id::text,
           to_char(cs.session_date, 'YYYY-MM-DD') as date,
           to_char(cs.session_date, ${dateFormat}) as date_label,
           to_char(cs.start_time, 'HH24:MI') as start_time,
           to_char(cs.end_time, 'HH24:MI') as end_time,
           cs.status, cs.topic, cs.notes,
           c.name as class_name, c.level::text as level,
           u.name as teacher_name
    from class_sessions cs
    join classes c on c.id = cs.class_id
    left join users u on u.id = cs.teacher_id
    where cs.id = ${id} and cs.organization_id = ${orgId}
    limit 1
  `) as Array<{
    id: string;
    class_id: string;
    date: string;
    date_label: string;
    start_time: string;
    end_time: string;
    status: SessionStatus;
    topic: string | null;
    notes: string | null;
    class_name: string;
    level: string;
    teacher_name: string | null;
  }>;
  if (!rows[0]) notFound();
  const s = rows[0];

  const roster = (await sql`
    select st.id::text, st.name,
           sa.status::text as att_status,
           sa.note as att_note,
           sa.qr_scan_id::text
    from students st
    left join session_attendance sa
      on sa.student_id = st.id and sa.session_id = ${id}
    where st.class_id = ${s.class_id} and st.organization_id = ${orgId}
    order by st.name
  `) as Array<{
    id: string;
    name: string;
    att_status: string | null;
    att_note: string | null;
    qr_scan_id: string | null;
  }>;

  const counts = roster.reduce(
    (acc, r) => {
      const key = r.att_status ?? "unmarked";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const t = await getTranslations("admin.sessions");
  const tStatus = await getTranslations("admin.sessions.statusLabel");
  const tKpi = await getTranslations("admin.sessions.kpi");

  return (
    <div>
      <Link
        href={`/admin/classes/${s.class_id}`}
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← {s.class_name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{s.date_label}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {s.start_time}–{s.end_time}
        {s.teacher_name ? ` · ${s.teacher_name}` : ""}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label={tKpi("present")} value={counts.present ?? 0} tone="emerald" />
        <KPI label={tKpi("late")} value={counts.late ?? 0} tone="amber" />
        <KPI label={tKpi("absent")} value={counts.absent ?? 0} tone="red" />
        <KPI label={tKpi("excused")} value={counts.excused ?? 0} tone="blue" />
      </div>
      {(counts.unmarked ?? 0) > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          {t("unmarkedWarn", { count: counts.unmarked })}
        </p>
      )}

      <section className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="mb-4 text-base font-bold">{t("boardTitle")}</h2>
        <AttendanceBoard sessionId={s.id} roster={roster} />
      </section>

      <section className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="mb-3 text-base font-bold">{t("metaTitle")}</h2>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          {t("currentStatus")}: <strong>{tStatus(s.status)}</strong>
        </p>
        <SessionStatusEditor
          sessionId={s.id}
          status={s.status}
          notes={s.notes}
          topic={s.topic}
        />
      </section>
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red" | "blue";
}) {
  const toneCls = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    blue: "text-blue-600",
  }[tone];
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-black ${toneCls}`}>{value}</p>
    </div>
  );
}
