import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { ClassForm } from "../class-form";
import { GenerateSessionsButton } from "./generate-button";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "휴강",
  rescheduled: "보강 예정",
};

const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-200 text-gray-600",
  rescheduled: "bg-purple-100 text-purple-700",
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select c.id::text, c.name, c.level::text, c.teacher_id::text,
           c.schedule, c.capacity, c.recurring_pattern
    from classes c
    where c.id = ${id} and c.organization_id = ${orgId}
    limit 1
  `) as Array<{
    id: string;
    name: string;
    level: string;
    teacher_id: string | null;
    schedule: string | null;
    capacity: number;
    recurring_pattern: { days?: string[]; start_time?: string; end_time?: string };
  }>;
  if (!rows[0]) notFound();
  const c = rows[0];

  const teachers = (await sql`
    select id::text, name from users
    where organization_id = ${orgId}
      and role in ('teacher','manager','owner','super_admin')
    order by name
  `) as { id: string; name: string }[];

  const students = (await sql`
    select id::text, name, korean_level::text from students
    where class_id = ${id} and organization_id = ${orgId}
    order by name
  `) as { id: string; name: string; korean_level: string | null }[];

  const sessions = (await sql`
    select cs.id::text,
           to_char(cs.session_date, 'YYYY-MM-DD') as date,
           to_char(cs.session_date, 'Dy') as dow,
           to_char(cs.start_time, 'HH24:MI') as start_time,
           to_char(cs.end_time, 'HH24:MI') as end_time,
           cs.status,
           cs.topic,
           u.name as teacher_name,
           (select count(*)::int from session_attendance sa
              where sa.session_id = cs.id and sa.status = 'present') as present_count
    from class_sessions cs
    left join users u on u.id = cs.teacher_id
    where cs.class_id = ${id} and cs.organization_id = ${orgId}
      and cs.session_date >= current_date - interval '7 days'
    order by cs.session_date, cs.start_time
    limit 30
  `) as Array<{
    id: string;
    date: string;
    dow: string;
    start_time: string;
    end_time: string;
    status: string;
    topic: string | null;
    teacher_name: string | null;
    present_count: number;
  }>;

  const hasPattern =
    (c.recurring_pattern?.days?.length ?? 0) > 0 &&
    !!c.recurring_pattern?.start_time &&
    !!c.recurring_pattern?.end_time;

  return (
    <div>
      <Link
        href="/admin/classes"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← 반 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">반 정보 수정</h2>
          <ClassForm
            mode="edit"
            teachers={teachers}
            initial={{
              id: c.id,
              name: c.name,
              level: c.level,
              teacherId: c.teacher_id,
              schedule: c.schedule,
              capacity: c.capacity,
              recurringPattern: c.recurring_pattern,
            }}
          />
        </section>

        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            배정 학생 ({students.length} / {c.capacity})
          </p>
          {students.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              아직 배정된 학생이 없어요.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="hover:text-[var(--color-primary-deep)]"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">수업 회차</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              지난 7일부터 향후 일정까지 (최대 30개)
            </p>
          </div>
          {hasPattern && <GenerateSessionsButton classId={c.id} />}
        </div>

        {!hasPattern ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            정기 수업 시간표(요일·시간)를 먼저 설정하면 회차가 자동 생성됩니다.
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            아직 회차가 없어요. 우측 위 <strong>회차 생성</strong> 버튼을 눌러주세요.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${STATUS_TONE[s.status]}`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="font-semibold">
                      {s.date} ({s.dow}) {s.start_time}–{s.end_time}
                    </span>
                    {s.teacher_name && (
                      <span className="text-xs text-[var(--color-muted)]">
                        · {s.teacher_name}
                      </span>
                    )}
                  </div>
                  {s.topic && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{s.topic}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-muted)]">
                    출석 {s.present_count}/{students.length}
                  </span>
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    className="text-xs font-bold text-[var(--color-primary-deep)] hover:underline"
                  >
                    출석 체크 →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
