import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";

export default async function AdminAttendancePage() {
  // 오늘 입실/퇴실 카운트 (Asia/Ho_Chi_Minh 기준일)
  const today = (await sql`
    select kind::text, count(*)::int as cnt
    from attendance_logs
    where logged_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
      and logged_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
    group by kind
  `) as { kind: string; cnt: number }[];
  const todayMap = Object.fromEntries(today.map((r) => [r.kind, r.cnt]));

  // 반별 오늘 입실 수
  const byClass = (await sql`
    select c.name as class_name, c.level::text as level,
           count(distinct al.student_id)::int as checked_in,
           c.capacity
    from classes c
    left join attendance_logs al on al.class_id = c.id
      and al.kind = 'check_in'
      and al.logged_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
      and al.logged_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day'
    group by c.id, c.name, c.level, c.capacity
    order by c.name
  `) as { class_name: string; level: string; checked_in: number; capacity: number }[];

  // 최근 30개 로그
  const recent = (await sql`
    select al.id::text, al.kind::text,
           to_char(al.logged_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as ts,
           s.id::text as student_id, s.name as student_name,
           c.name as class_name
    from attendance_logs al
    join students s on s.id = al.student_id
    left join classes c on c.id = al.class_id
    order by al.logged_at desc
    limit 30
  `) as Array<{
    id: string;
    kind: string;
    ts: string;
    student_id: string;
    student_name: string;
    class_name: string | null;
  }>;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Attendance
      </p>
      <h1 className="mt-1 text-2xl font-bold">출석 관리</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        오늘 출석 현황 + 최근 QR 스캔 기록 (Asia/Ho_Chi_Minh 기준)
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            오늘 입실
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {todayMap.check_in ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            오늘 퇴실
          </p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {todayMap.check_out ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            현재 학원 안
          </p>
          <p className="mt-2 text-3xl font-black">
            {Math.max((todayMap.check_in ?? 0) - (todayMap.check_out ?? 0), 0)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">입실 - 퇴실</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">반별 오늘 출석</h2>
        {byClass.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-line)] bg-white p-6 text-center text-sm text-[var(--color-muted)]">
            아직 개설된 반이 없어요.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byClass.map((r) => (
              <li
                key={r.class_name}
                className="rounded-lg border border-[var(--color-line)] bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-deep)]">
                  {r.level}
                </p>
                <p className="mt-1 text-sm font-bold">{r.class_name}</p>
                <p className="mt-2 text-2xl font-black">
                  {r.checked_in}
                  <span className="text-sm font-normal text-[var(--color-muted)]">
                    {" / "}{r.capacity}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">최근 QR 스캔 ({recent.length})</h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-line)] bg-white p-6 text-center text-sm text-[var(--color-muted)]">
            아직 스캔 기록이 없어요. QR 출석 라우트(`/qr/[token]`)를 학생용 QR로 이용하면 여기 쌓여요.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white divide-y divide-[var(--color-line)] text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      l.kind === "check_in"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {l.kind === "check_in" ? "입실" : "퇴실"}
                  </span>
                  <Link
                    href={`/admin/students/${l.student_id}`}
                    className="font-semibold hover:text-[var(--color-primary-deep)]"
                  >
                    {l.student_name}
                  </Link>
                  {l.class_name && (
                    <span className="text-xs text-[var(--color-muted)]">{l.class_name}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--color-muted)]">{l.ts}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
