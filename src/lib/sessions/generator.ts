/**
 * 반의 recurring_pattern을 기반으로 향후 회차를 자동 생성한다.
 * 이미 존재하는 (class_id, session_date, start_time)은 건너뜀.
 */

import { sql } from "@/lib/db/client";

export type RecurringPattern = {
  days?: Array<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat">;
  start_time?: string; // "19:00"
  end_time?: string;   // "21:00"
};

const DAY_TO_DOW: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export type GenerateInput = {
  classId: string;
  organizationId: string;
  weeks?: number;     // 몇 주치 생성, 기본 4
  startDate?: Date;   // 시작 기준일 (기본: 오늘)
};

export async function generateSessions(input: GenerateInput): Promise<{
  generated: number;
  skipped: number;
}> {
  const weeks = input.weeks ?? 4;
  const start = input.startDate ?? new Date();

  // 반의 recurring_pattern, teacher_id 가져오기
  const rows = (await sql`
    select recurring_pattern, teacher_id::text
    from classes
    where id = ${input.classId} and organization_id = ${input.organizationId}
    limit 1
  `) as Array<{ recurring_pattern: RecurringPattern; teacher_id: string | null }>;
  if (!rows[0]) throw new Error("class not found");

  const pat = rows[0].recurring_pattern ?? {};
  const days = pat.days ?? [];
  const startTime = pat.start_time;
  const endTime = pat.end_time;
  if (days.length === 0 || !startTime || !endTime) {
    return { generated: 0, skipped: 0 };
  }
  const teacherId = rows[0].teacher_id;

  const dows = new Set(days.map((d) => DAY_TO_DOW[d]).filter((v) => v !== undefined));
  const dates: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (dows.has(d.getDay())) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  if (dates.length === 0) return { generated: 0, skipped: 0 };

  // 한 번에 INSERT (unique 인덱스에 충돌하면 SKIP)
  let generated = 0;
  for (const date of dates) {
    const result = (await sql`
      insert into class_sessions
        (organization_id, class_id, session_date, start_time, end_time, teacher_id, status)
      values
        (${input.organizationId}, ${input.classId}, ${date}::date,
         ${startTime}::time, ${endTime}::time, ${teacherId}, 'scheduled')
      on conflict (class_id, session_date, start_time) do nothing
      returning id
    `) as { id: string }[];
    if (result.length > 0) generated += 1;
  }
  return { generated, skipped: dates.length - generated };
}
