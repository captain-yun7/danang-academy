"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "@/lib/db/client";
import { distanceMeters } from "@/lib/geo";
import { normalizeVn } from "@/lib/vn-text";

const LATE_THRESHOLD_MIN = 10;
const SEARCH_LIMIT = 8;

export type SearchStudentRow = {
  id: string;
  name: string;
  hint: string | null;
};

export type AttendResult =
  | {
      ok: true;
      studentName: string;
      className: string;
      status: "present" | "late";
      time: string;
    }
  | {
      ok: false;
      reason:
        | "no_session"
        | "gps_out"
        | "not_in_class"
        | "fp_dup"
        | "already";
      message?: string;
      alreadyTime?: string;
    };

async function getDeviceFp(): Promise<{ fp: string; ip: string | null }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const ua = h.get("user-agent") ?? "";
  const accept = h.get("accept-language") ?? "";
  const fp = createHash("sha256")
    .update(`${ip ?? "noip"}|${ua}|${accept}`)
    .digest("hex")
    .slice(0, 32);
  return { fp, ip };
}

async function logAttempt(args: {
  organizationId: string;
  classId?: string | null;
  sessionId?: string | null;
  studentId?: string | null;
  deviceFp?: string | null;
  ip?: string | null;
  lat?: number | null;
  lng?: number | null;
  result: string;
  message?: string;
}) {
  await sql`
    insert into attendance_attempts
      (organization_id, class_id, session_id, student_id, device_fp, ip, lat, lng, result, message)
    values
      (${args.organizationId}, ${args.classId ?? null}::uuid, ${args.sessionId ?? null}::uuid,
       ${args.studentId ?? null}::uuid, ${args.deviceFp ?? null}, ${args.ip ?? null},
       ${args.lat ?? null}, ${args.lng ?? null}, ${args.result}, ${args.message ?? null})
  `.catch(() => undefined);
}

export async function searchStudent({
  classId,
  organizationId,
  query,
}: {
  classId: string;
  organizationId: string;
  query: string;
}): Promise<SearchStudentRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // 베트남어 성조부호 무시 검색: 학생이 "Bao han"으로 입력해도 "Bảo Hân" 매칭.
  // 반 단위 학생 수가 적으므로 활성 학생을 모두 가져와 서버에서 정규화 비교한다.
  const nq = normalizeVn(q);

  const rows = (await sql`
    select id::text, name,
           to_char(enrolled_at, 'YYYY-MM-DD') as hint
    from students
    where class_id = ${classId}::uuid
      and organization_id = ${organizationId}::uuid
      and status = 'active'
    order by name
  `) as Array<{ id: string; name: string; hint: string | null }>;

  return rows
    .filter((r) => normalizeVn(r.name).includes(nq))
    .slice(0, SEARCH_LIMIT);
}

export async function submitAttendance({
  classToken,
  studentId,
  lat,
  lng,
}: {
  classToken: string;
  studentId: string;
  lat: number;
  lng: number;
}): Promise<AttendResult> {
  // 1. classToken → 반 + 학원 좌표
  const classRows = (await sql`
    select c.id::text as class_id, c.name as class_name,
           c.organization_id::text,
           o.lat as org_lat, o.lng as org_lng, o.gps_radius_m
    from classes c
    join organizations o on o.id = c.organization_id
    where c.qr_token = ${classToken}
    limit 1
  `) as Array<{
    class_id: string;
    class_name: string;
    organization_id: string;
    org_lat: string | null;
    org_lng: string | null;
    gps_radius_m: number;
  }>;
  if (!classRows[0]) {
    return { ok: false, reason: "no_session", message: "invalid_token" };
  }
  const cls = classRows[0];
  const { fp, ip } = await getDeviceFp();

  // 2. 학생이 그 반 등록자인지
  const stuRows = (await sql`
    select id::text, name from students
    where id = ${studentId}::uuid
      and class_id = ${cls.class_id}::uuid
      and organization_id = ${cls.organization_id}::uuid
      and status = 'active'
    limit 1
  `) as Array<{ id: string; name: string }>;
  if (!stuRows[0]) {
    await logAttempt({
      organizationId: cls.organization_id,
      classId: cls.class_id,
      studentId,
      deviceFp: fp,
      ip,
      lat,
      lng,
      result: "not_in_class",
    });
    return { ok: false, reason: "not_in_class" };
  }
  const student = stuRows[0];

  // 3. GPS 검증 (학원 좌표 등록된 경우만)
  if (cls.org_lat !== null && cls.org_lng !== null) {
    const dist = distanceMeters(lat, lng, Number(cls.org_lat), Number(cls.org_lng));
    if (dist > cls.gps_radius_m) {
      await logAttempt({
        organizationId: cls.organization_id,
        classId: cls.class_id,
        studentId,
        deviceFp: fp,
        ip,
        lat,
        lng,
        result: "gps_out",
        message: `${Math.round(dist)}m`,
      });
      return { ok: false, reason: "gps_out" };
    }
  }

  // 4. ±30분 회차 매칭
  const sessionRows = (await sql`
    select id::text,
           extract(epoch from (now() at time zone 'Asia/Ho_Chi_Minh'
                               - (session_date + start_time)))::int as offset_sec
    from class_sessions
    where class_id = ${cls.class_id}::uuid
      and organization_id = ${cls.organization_id}::uuid
      and session_date = (current_date at time zone 'Asia/Ho_Chi_Minh')::date
      and (now() at time zone 'Asia/Ho_Chi_Minh') between
          (session_date + start_time - interval '30 minutes')
          and (session_date + end_time + interval '30 minutes')
      and status in ('scheduled', 'in_progress')
    order by abs(extract(epoch from (now() at time zone 'Asia/Ho_Chi_Minh'
                                     - (session_date + start_time))))
    limit 1
  `) as Array<{ id: string; offset_sec: number }>;
  if (!sessionRows[0]) {
    await logAttempt({
      organizationId: cls.organization_id,
      classId: cls.class_id,
      studentId: student.id,
      deviceFp: fp,
      ip,
      lat,
      lng,
      result: "no_session",
    });
    return { ok: false, reason: "no_session" };
  }
  const sess = sessionRows[0];

  // 5. 본인이 이미 출석된 상태인지
  const existing = (await sql`
    select status::text, to_char(marked_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') as time
    from session_attendance
    where session_id = ${sess.id}::uuid and student_id = ${student.id}::uuid
    limit 1
  `) as Array<{ status: string; time: string }>;
  if (existing[0]) {
    await logAttempt({
      organizationId: cls.organization_id,
      classId: cls.class_id,
      sessionId: sess.id,
      studentId: student.id,
      deviceFp: fp,
      ip,
      lat,
      lng,
      result: "already",
    });
    return { ok: false, reason: "already", alreadyTime: existing[0].time };
  }

  // 6. 같은 회차에 같은 디바이스가 다른 학생을 출석시킨 적 있는지
  const dupRows = (await sql`
    select 1 from attendance_attempts
    where session_id = ${sess.id}::uuid
      and student_id is not null
      and student_id <> ${student.id}::uuid
      and device_fp = ${fp}
      and result = 'success'
    limit 1
  `) as Array<{ "?column?": number }>;
  if (dupRows.length > 0) {
    await logAttempt({
      organizationId: cls.organization_id,
      classId: cls.class_id,
      sessionId: sess.id,
      studentId: student.id,
      deviceFp: fp,
      ip,
      lat,
      lng,
      result: "fp_dup",
    });
    return { ok: false, reason: "fp_dup" };
  }

  // 7. INSERT — 시작 +10분 이후면 late
  const status: "present" | "late" =
    sess.offset_sec > LATE_THRESHOLD_MIN * 60 ? "late" : "present";

  await sql`
    insert into session_attendance
      (session_id, student_id, organization_id, status, marked_at)
    values
      (${sess.id}::uuid, ${student.id}::uuid, ${cls.organization_id}::uuid,
       ${status}::session_attendance_status, now())
    on conflict (session_id, student_id) do update
    set status = excluded.status, marked_at = excluded.marked_at
  `;

  await logAttempt({
    organizationId: cls.organization_id,
    classId: cls.class_id,
    sessionId: sess.id,
    studentId: student.id,
    deviceFp: fp,
    ip,
    lat,
    lng,
    result: "success",
    message: status,
  });

  const time = new Date().toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    ok: true,
    studentName: student.name,
    className: cls.class_name,
    status,
    time,
  };
}
