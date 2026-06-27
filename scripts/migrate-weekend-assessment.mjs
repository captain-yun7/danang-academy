/**
 * 일회성 마이그레이션 — 주말 평가: assessment_rounds / assessment_scores + 등급 컷 컬럼.
 * scripts/migrations/2026-06-27-weekend-assessment.sql 과 동일. 멱등 — 재실행 안전.
 *
 * 사용:  node --env-file=.env.production.local scripts/migrate-weekend-assessment.mjs
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);

const STATEMENTS = [
  `create table if not exists assessment_rounds (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    class_id uuid not null references classes(id) on delete cascade,
    title text not null,
    assessment_date date not null,
    created_by uuid,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists assessment_rounds_org on assessment_rounds(organization_id, assessment_date desc)`,
  `create index if not exists assessment_rounds_class on assessment_rounds(class_id)`,
  `create table if not exists assessment_scores (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references assessment_rounds(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    organization_id uuid not null,
    listening_score int,
    speaking_score int,
    reading_score int,
    writing_score int,
    pronunciation_score int,
    parent_comment text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (round_id, student_id)
  )`,
  `create index if not exists assessment_scores_round on assessment_scores(round_id)`,
  `create index if not exists assessment_scores_student on assessment_scores(student_id)`,
  `alter table organizations
    add column if not exists grade_cut_excellent int not null default 90,
    add column if not exists grade_cut_good int not null default 75,
    add column if not exists grade_cut_normal int not null default 60`,
];

let ok = 0;
for (let i = 0; i < STATEMENTS.length; i++) {
  try {
    await sql.query(STATEMENTS[i]);
    ok++;
    console.log(`  [${i + 1}/${STATEMENTS.length}] ok`);
  } catch (e) {
    console.error(`  [${i + 1}/${STATEMENTS.length}] FAILED:`, e.message);
    process.exit(1);
  }
}
console.log(`→ 완료: ${ok}/${STATEMENTS.length} statement 적용`);
