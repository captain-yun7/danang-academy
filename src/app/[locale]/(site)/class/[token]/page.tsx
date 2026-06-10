import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { ClassAttendClient } from "./class-attend-client";

type ClassRow = {
  class_id: string;
  class_name: string;
  organization_id: string;
  gps_required: boolean;
};

type SessionRow = {
  start_time: string;
  end_time: string;
};

async function findClass(token: string): Promise<ClassRow | null> {
  if (!token || token.length < 10) return null;
  const rows = (await sql`
    select c.id::text as class_id, c.name as class_name, c.organization_id::text,
           (o.lat is not null and o.lng is not null) as gps_required
    from classes c
    join organizations o on o.id = c.organization_id
    where c.qr_token = ${token}
    limit 1
  `) as Array<ClassRow>;
  return rows[0] ?? null;
}

async function findNearbySession(
  classId: string,
  organizationId: string
): Promise<SessionRow | null> {
  const rows = (await sql`
    select to_char(start_time, 'HH24:MI') as start_time,
           to_char(end_time, 'HH24:MI') as end_time
    from class_sessions
    where class_id = ${classId}::uuid
      and organization_id = ${organizationId}::uuid
      and session_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (now() at time zone 'Asia/Ho_Chi_Minh') between
          (session_date + start_time - interval '30 minutes')
          and (session_date + end_time + interval '30 minutes')
      and status in ('scheduled', 'in_progress')
    order by abs(extract(epoch from (now() at time zone 'Asia/Ho_Chi_Minh'
                                     - (session_date + start_time))))
    limit 1
  `) as Array<SessionRow>;
  return rows[0] ?? null;
}

async function findNextSession(
  classId: string,
  organizationId: string
): Promise<{ time: string } | null> {
  const rows = (await sql`
    select to_char(session_date + start_time, 'MM/DD HH24:MI') as time
    from class_sessions
    where class_id = ${classId}::uuid
      and organization_id = ${organizationId}::uuid
      and (session_date + start_time) > (now() at time zone 'Asia/Ho_Chi_Minh')
      and status in ('scheduled', 'in_progress')
    order by session_date + start_time
    limit 1
  `) as Array<{ time: string }>;
  return rows[0] ?? null;
}

export default async function ClassQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("classAttend");
  const klass = await findClass(token);

  if (!klass) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-5xl text-red-500">
          !
        </div>
        <h1 className="mt-6 text-2xl font-black">{t("err.notFoundTitle")}</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("err.notFoundDesc")}</p>
      </main>
    );
  }

  const session = await findNearbySession(klass.class_id, klass.organization_id);
  if (!session) {
    const next = await findNextSession(klass.class_id, klass.organization_id);
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-5xl text-amber-600">
          ?
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-600">
          {klass.class_name}
        </p>
        <h1 className="mt-2 text-2xl font-black">{t("err.noSessionTitle")}</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {next
            ? t("err.noSessionWithNext", { time: next.time })
            : t("err.noSessionDesc")}
        </p>
      </main>
    );
  }

  return (
    <ClassAttendClient
      classToken={token}
      classId={klass.class_id}
      organizationId={klass.organization_id}
      className={klass.class_name}
      sessionTimeLabel={`${session.start_time}–${session.end_time}`}
      gpsRequired={klass.gps_required}
    />
  );
}
