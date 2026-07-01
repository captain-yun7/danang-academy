import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["super_admin", "owner", "manager"] as const;

// scripts/migrations/2026-07-01-weekly-test.sql 과 동일한 내용 — 파일은 문서/이력용, 실행은 이 배열.
// 멱등 SQL이므로 재실행 안전. neon http 드라이버는 statement 1개씩 실행.
// (이전 마이그레이션들은 이미 적용 완료 — 멱등이므로 필요 시 해당 파일/이력에서 재실행)
const STATEMENTS: string[] = [
  `create table if not exists weekly_tests (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    class_id uuid not null references classes(id) on delete cascade,
    title text not null,
    lesson_range text,
    status text not null default 'draft',
    total_score int not null default 400,
    created_by uuid,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists weekly_tests_org on weekly_tests(organization_id, created_at desc)`,
  `create index if not exists weekly_tests_class on weekly_tests(class_id)`,
  `create table if not exists weekly_sections (
    id uuid primary key default gen_random_uuid(),
    test_id uuid not null references weekly_tests(id) on delete cascade,
    skill text not null,
    section_title text not null,
    max_score int not null default 0,
    order_index int not null default 0
  )`,
  `create index if not exists weekly_sections_test on weekly_sections(test_id, skill, order_index)`,
  `create table if not exists weekly_questions (
    id uuid primary key default gen_random_uuid(),
    test_id uuid not null references weekly_tests(id) on delete cascade,
    section_id uuid not null references weekly_sections(id) on delete cascade,
    skill text not null,
    question_type text not null,
    question_text text,
    passage_text text,
    listening_script text,
    audio_key text,
    tts_status text,
    options jsonb,
    correct_answer jsonb,
    points int not null default 0,
    max_play_count int not null default 2,
    order_index int not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists weekly_questions_test on weekly_questions(test_id, section_id, order_index)`,
  `create table if not exists weekly_answers (
    id uuid primary key default gen_random_uuid(),
    test_id uuid not null references weekly_tests(id) on delete cascade,
    question_id uuid not null references weekly_questions(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    organization_id uuid not null,
    answer_text text,
    selected_option jsonb,
    audio_answer_url text,
    transcript text,
    is_correct boolean,
    auto_score int,
    ai_score int,
    teacher_score int,
    final_score int,
    ai_feedback text,
    teacher_comment text,
    status text not null default 'pending',
    submitted_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (test_id, question_id, student_id)
  )`,
  `create index if not exists weekly_answers_student on weekly_answers(test_id, student_id)`,
  `create table if not exists weekly_results (
    id uuid primary key default gen_random_uuid(),
    test_id uuid not null references weekly_tests(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    organization_id uuid not null,
    listening_score int,
    reading_score int,
    writing_ai_score int,
    writing_teacher_score int,
    writing_final_score int,
    speaking_score int,
    total_score int,
    average_score numeric(6,2),
    status text not null default 'doing',
    teacher_comment text,
    submitted_at timestamptz,
    finalized_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (test_id, student_id)
  )`,
  `create index if not exists weekly_results_test on weekly_results(test_id)`,
];

export async function POST() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results: { statement_index: number; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < STATEMENTS.length; i++) {
    try {
      await sql.query(STATEMENTS[i]);
      results.push({ statement_index: i, ok: true });
    } catch (e) {
      results.push({
        statement_index: i,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
