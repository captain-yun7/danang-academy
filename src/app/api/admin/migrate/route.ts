import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["super_admin", "owner", "manager"] as const;

// scripts/migrations/2026-06-30-online-exam.sql 과 동일한 내용 — 파일은 문서/이력용, 실행은 이 배열.
// 멱등 SQL이므로 재실행 안전. neon http 드라이버는 statement 1개씩 실행.
// (이전 마이그레이션들은 이미 적용 완료 — 멱등이므로 필요 시 해당 파일/이력에서 재실행)
const STATEMENTS: string[] = [
  `create table if not exists exams (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    class_id uuid not null references classes(id) on delete cascade,
    title text not null,
    exam_date date not null,
    status text not null default 'draft',
    reading_passage_ko text,
    reading_passage_vi text,
    w_listening int not null default 20,
    w_reading int not null default 20,
    w_grammar int not null default 30,
    w_writing int not null default 15,
    w_speaking int not null default 15,
    created_by uuid,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists exams_org on exams(organization_id, exam_date desc)`,
  `create index if not exists exams_class on exams(class_id)`,
  `create table if not exists exam_questions (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid not null references exams(id) on delete cascade,
    section text not null,
    order_no int not null default 0,
    prompt_ko text,
    prompt_vi text,
    choices jsonb,
    answer_index int,
    points int not null default 0,
    audio_key text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists exam_questions_exam on exam_questions(exam_id, section, order_no)`,
  `create table if not exists exam_attempts (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid not null references exams(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    organization_id uuid not null,
    status text not null default 'in_progress',
    listening_score int,
    reading_score int,
    grammar_vocab_score int,
    writing_score int,
    speaking_score int,
    total_score int,
    parent_comment text,
    started_at timestamptz not null default now(),
    submitted_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (exam_id, student_id)
  )`,
  `create index if not exists exam_attempts_exam on exam_attempts(exam_id)`,
  `create index if not exists exam_attempts_student on exam_attempts(student_id)`,
  `create table if not exists exam_answers (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references exam_attempts(id) on delete cascade,
    question_id uuid not null references exam_questions(id) on delete cascade,
    organization_id uuid not null,
    choice_index int,
    answer_text text,
    audio_key text,
    transcript text,
    awarded_points int,
    ai_score int,
    ai_feedback text,
    teacher_score int,
    teacher_comment text,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (attempt_id, question_id)
  )`,
  `create index if not exists exam_answers_attempt on exam_answers(attempt_id)`,
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
