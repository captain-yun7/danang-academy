/**
 * 베타 테스트용 가계정 시드 (멱등)
 *
 * - 운영진 3종: 원장 / 매니저 / 강사
 * - 데모 반 2개, 학생 4명, 상담 리드 2건
 *
 * 사용:
 *   node --env-file=.env.local scripts/seed-beta.mjs
 *
 * 비밀번호는 BETA_PASSWORD env 로 override 가능 (기본 'Beta!2026').
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (set in .env.local)");
  process.exit(1);
}
const sql = neon(url);

const ORG_SLUG = process.env.BETA_ORG_SLUG ?? "danang";
const PASSWORD = process.env.BETA_PASSWORD ?? "Beta!2026";

const ACCOUNTS = [
  { email: "owner-beta@test.com", name: "베타 원장", role: "owner" },
  { email: "manager-beta@test.com", name: "베타 매니저", role: "manager" },
  { email: "teacher-beta@test.com", name: "베타 강사", role: "teacher" },
];

async function seedAccounts(orgId) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const a of ACCOUNTS) {
    const existing = await sql`select id from users where email = ${a.email} limit 1`;
    if (existing[0]) {
      await sql`
        update users
        set password_hash = ${hash},
            name = ${a.name},
            role = ${a.role}::user_role,
            organization_id = ${orgId},
            email_verified = coalesce(email_verified, now())
        where email = ${a.email}
      `;
      console.log(`  · 갱신 ${a.role.padEnd(8)} ${a.email}`);
    } else {
      await sql`
        insert into users (email, password_hash, name, role, organization_id, email_verified)
        values (${a.email}, ${hash}, ${a.name}, ${a.role}::user_role, ${orgId}, now())
      `;
      console.log(`  · 신규 ${a.role.padEnd(8)} ${a.email}`);
    }
  }
}

async function seedDemoClassesAndStudents(orgId) {
  const teacherRows = await sql`select id::text from users where email = 'teacher-beta@test.com' limit 1`;
  const teacherId = teacherRows[0]?.id ?? null;

  const existing = await sql`
    select count(*)::int as cnt from classes where organization_id = ${orgId} and name like 'Beta %'
  `;
  if (existing[0].cnt > 0) {
    console.log("  · 데모 반/학생 이미 존재 — 스킵");
    return;
  }

  const classes = await sql`
    insert into classes (name, level, schedule, capacity, recurring_pattern, teacher_id, organization_id)
    values
      ('Beta 중급반', 'intermediate', '월·수·금 19:00–21:00', 12,
       ${JSON.stringify({ days: ["mon","wed","fri"], start_time: "19:00", end_time: "21:00" })}::jsonb,
       ${teacherId}::uuid, ${orgId}),
      ('Beta 초급반', 'elementary', '화·목 18:00–20:00', 10,
       ${JSON.stringify({ days: ["tue","thu"], start_time: "18:00", end_time: "20:00" })}::jsonb,
       ${teacherId}::uuid, ${orgId})
    returning id::text, name
  `;
  const class1 = classes[0].id;
  const class2 = classes[1].id;

  await sql`
    insert into students (name, phone, native_language, korean_level, class_id, status, organization_id)
    values
      ('Beta 학생 응웬', '+84 911 222 333', 'vi', 'intermediate', ${class1}::uuid, 'active', ${orgId}),
      ('Beta 학생 팜',   '+84 922 333 444', 'vi', 'elementary',   ${class2}::uuid, 'active', ${orgId}),
      ('Beta 학생 김',   '+84 933 444 555', 'other', 'intermediate', ${class1}::uuid, 'active', ${orgId}),
      ('Beta 학생 호아', '+84 944 555 666', 'vi', 'beginner',     null,             'paused', ${orgId})
  `;
  await sql`
    insert into consult_leads (name, phone, source, recommended_level, status, note, organization_id)
    values
      ('Beta 리드 르엉', '+84 955 666 777', 'placement_test',     'intermediate', 'new',       '발음 좋음',        ${orgId}),
      ('Beta 리드 푸엉', '+84 966 777 888', 'pronunciation_test', 'beginner',     'contacted', '주말 수업 희망',    ${orgId})
  `;
  console.log("  · 데모 반 2 / 학생 4 / 리드 2 생성");
}

const orgRows = await sql`select id::text from organizations where slug = ${ORG_SLUG} limit 1`;
if (orgRows.length === 0) {
  console.error(`organization slug '${ORG_SLUG}' not found`);
  process.exit(1);
}
const orgId = orgRows[0].id;

console.log(`\n→ 베타 계정 시드 (org=${ORG_SLUG})`);
await seedAccounts(orgId);
console.log(`\n→ 데모 데이터 시드`);
await seedDemoClassesAndStudents(orgId);

console.log(`\n완료. 로그인 정보:\n`);
for (const a of ACCOUNTS) {
  console.log(`  ${a.role.padEnd(8)} ${a.email}  /  ${PASSWORD}`);
}
console.log("");
