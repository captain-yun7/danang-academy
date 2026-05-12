import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

const DEDUP_SECONDS = 30;

type Action = "checked_in" | "checked_out" | "already_out" | "duplicate";

type ScanResult =
  | {
      ok: true;
      action: Action;
      studentName: string;
      className: string | null;
      time: string;
    }
  | { ok: false; reason: "not_found" };

async function processScan(token: string): Promise<ScanResult> {
  if (!token || token.length < 10) return { ok: false, reason: "not_found" };
  const organizationId = await getCurrentOrgId();

  const students = (await sql`
    select s.id::text, s.name, s.class_id::text, c.name as class_name
    from students s
    left join classes c on c.id = s.class_id
    where s.qr_token = ${token} and s.organization_id = ${organizationId}
    limit 1
  `) as Array<{
    id: string;
    name: string;
    class_id: string | null;
    class_name: string | null;
  }>;
  if (!students[0]) return { ok: false, reason: "not_found" };
  const student = students[0];

  // 오늘(VN 시간대) 로그 + 가장 최근 로그의 경과 초
  const logs = (await sql`
    select kind::text,
           extract(epoch from (now() - logged_at))::int as seconds_ago
    from attendance_logs
    where student_id = ${student.id}
      and organization_id = ${organizationId}
      and logged_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
      and logged_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
    order by logged_at desc
  `) as { kind: string; seconds_ago: number }[];

  const last = logs[0];
  const hasCheckIn = logs.some((l) => l.kind === "check_in");
  const hasCheckOut = logs.some((l) => l.kind === "check_out");

  // 30초 내 중복 스캔 방지
  if (last && last.seconds_ago < DEDUP_SECONDS) {
    return {
      ok: true,
      action: "duplicate",
      studentName: student.name,
      className: student.class_name,
      time: nowVN(),
    };
  }

  let action: Action;
  let logId: string | null = null;
  if (!hasCheckIn) {
    const ins = (await sql`
      insert into attendance_logs (student_id, class_id, kind, organization_id)
      values (${student.id}, ${student.class_id ? student.class_id : null}::uuid, 'check_in', ${organizationId})
      returning id::text
    `) as { id: string }[];
    logId = ins[0]?.id ?? null;
    action = "checked_in";
  } else if (!hasCheckOut) {
    const ins = (await sql`
      insert into attendance_logs (student_id, class_id, kind, organization_id)
      values (${student.id}, ${student.class_id ? student.class_id : null}::uuid, 'check_out', ${organizationId})
      returning id::text
    `) as { id: string }[];
    logId = ins[0]?.id ?? null;
    action = "checked_out";
  } else {
    action = "already_out";
  }

  // 수업 통합 — check_in 시점에 진행 중(±30분)인 그 학생의 수업이 있으면 session_attendance 자동 마킹
  if (action === "checked_in" && student.class_id) {
    const matches = (await sql`
      select id::text,
             extract(epoch from (now() at time zone 'Asia/Ho_Chi_Minh'
                                 - (session_date + start_time)))::int as offset_sec
      from class_sessions
      where class_id = ${student.class_id}
        and organization_id = ${organizationId}
        and session_date = (current_date at time zone 'Asia/Ho_Chi_Minh')::date
        and (now() at time zone 'Asia/Ho_Chi_Minh') between
            (session_date + start_time - interval '30 minutes')
            and (session_date + end_time + interval '30 minutes')
        and status in ('scheduled', 'in_progress')
      order by abs(extract(epoch from (now() at time zone 'Asia/Ho_Chi_Minh'
                                       - (session_date + start_time))))
      limit 1
    `) as { id: string; offset_sec: number }[];

    if (matches[0]) {
      // 늦으면 지각, 아니면 출석
      const lateThresholdSec = 10 * 60; // 시작 10분 후부터 지각
      const status = matches[0].offset_sec > lateThresholdSec ? "late" : "present";
      await sql`
        insert into session_attendance
          (session_id, student_id, organization_id, status, marked_at, qr_scan_id)
        values (${matches[0].id}, ${student.id}, ${organizationId},
                ${status}::session_attendance_status, now(), ${logId}::uuid)
        on conflict (session_id, student_id) do update
        set status = excluded.status,
            marked_at = excluded.marked_at,
            qr_scan_id = excluded.qr_scan_id
      `.catch(() => undefined);
    }
  }

  return {
    ok: true,
    action,
    studentName: student.name,
    className: student.class_name,
    time: nowVN(),
  };
}

function nowVN() {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function QRPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await processScan(token);
  const t = await getTranslations("qr");

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="text-6xl">❓</div>
        <h1 className="mt-4 text-2xl font-bold">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{t("notFound.desc")}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border-2 border-[var(--color-line)] px-5 py-2 text-sm font-bold"
        >
          {t("notFound.home")}
        </Link>
      </main>
    );
  }

  const ui = stateUI(result.action);

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className={`flex h-32 w-32 items-center justify-center rounded-full text-7xl ${ui.bg}`}>
        {ui.emoji}
      </div>
      <p className={`mt-6 text-xs font-bold uppercase tracking-widest ${ui.accent}`}>
        {t(`${ui.key}.tag`)}
      </p>
      <h1 className="mt-2 text-3xl font-black">
        {t(`${ui.key}.title`, { name: result.studentName })}
      </h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {t(`${ui.key}.subtitle`)}
      </p>

      <div className="mt-8 grid w-full grid-cols-2 gap-3 text-left">
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("labels.class")}
          </p>
          <p className="mt-1 text-sm font-bold">
            {result.className ?? t("labels.unassigned")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("labels.time")}
          </p>
          <p className="mt-1 text-sm font-bold">{result.time}</p>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-[var(--color-muted)]">
        {t("labels.showStaff")}
      </p>
    </main>
  );
}

function stateUI(action: Action) {
  switch (action) {
    case "checked_in":
      return {
        emoji: "👋",
        bg: "bg-emerald-50",
        accent: "text-emerald-600",
        key: "checkedIn" as const,
      };
    case "checked_out":
      return {
        emoji: "👍",
        bg: "bg-amber-50",
        accent: "text-amber-600",
        key: "checkedOut" as const,
      };
    case "already_out":
      return {
        emoji: "✅",
        bg: "bg-gray-100",
        accent: "text-gray-600",
        key: "alreadyOut" as const,
      };
    case "duplicate":
      return {
        emoji: "⏱️",
        bg: "bg-blue-50",
        accent: "text-blue-600",
        key: "duplicate" as const,
      };
  }
}
