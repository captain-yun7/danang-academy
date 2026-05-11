import { Link } from "@/i18n/navigation";
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
  if (!hasCheckIn) {
    await sql`
      insert into attendance_logs (student_id, class_id, kind, organization_id)
      values (${student.id}, ${student.class_id ? student.class_id : null}::uuid, 'check_in', ${organizationId})
    `;
    action = "checked_in";
  } else if (!hasCheckOut) {
    await sql`
      insert into attendance_logs (student_id, class_id, kind, organization_id)
      values (${student.id}, ${student.class_id ? student.class_id : null}::uuid, 'check_out', ${organizationId})
    `;
    action = "checked_out";
  } else {
    action = "already_out";
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

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="text-6xl">❓</div>
        <h1 className="mt-4 text-2xl font-bold">QR을 인식하지 못했어요</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          QR이 유효하지 않거나 만료되었습니다. 학원 직원에게 문의해주세요.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border-2 border-[var(--color-line)] px-5 py-2 text-sm font-bold"
        >
          홈으로
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
        {ui.tag}
      </p>
      <h1 className="mt-2 text-3xl font-black">{ui.title(result.studentName)}</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{ui.subtitle}</p>

      <div className="mt-8 grid w-full grid-cols-2 gap-3 text-left">
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            반
          </p>
          <p className="mt-1 text-sm font-bold">{result.className ?? "미배정"}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            시각
          </p>
          <p className="mt-1 text-sm font-bold">{result.time}</p>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-[var(--color-muted)]">
        이 화면을 직원에게 보여주세요. 화면을 닫으면 처리 완료입니다.
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
        tag: "INPUT · 입실",
        title: (name: string) => `${name}님, 어서 오세요!`,
        subtitle: "오늘 입실이 기록되었어요. 좋은 수업 되세요.",
      };
    case "checked_out":
      return {
        emoji: "👍",
        bg: "bg-amber-50",
        accent: "text-amber-600",
        tag: "OUTPUT · 퇴실",
        title: (name: string) => `${name}님, 수고하셨어요!`,
        subtitle: "오늘 퇴실이 기록되었어요. 다음에 또 만나요.",
      };
    case "already_out":
      return {
        emoji: "✅",
        bg: "bg-gray-100",
        accent: "text-gray-600",
        tag: "DONE · 완료",
        title: (name: string) => `${name}님, 오늘은 이미 끝!`,
        subtitle: "오늘은 이미 입실·퇴실 모두 기록되었어요.",
      };
    case "duplicate":
      return {
        emoji: "⏱️",
        bg: "bg-blue-50",
        accent: "text-blue-600",
        tag: "RECENT · 직전 기록",
        title: (name: string) => `${name}님, 잠시만요`,
        subtitle: "방금 전에 스캔되었어요. 30초 후에 다시 시도해주세요.",
      };
  }
}
