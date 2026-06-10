import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["super_admin", "owner", "manager"] as const;

// scripts/migrations/2026-06-10-pronunciation-v2.sql 과 동일한 내용 — 파일은 문서/이력용, 실행은 이 배열.
// 멱등 SQL이므로 재실행 안전. neon http 드라이버는 statement 1개씩 실행.
const STATEMENTS: string[] = [
  `alter type assignment_type add value if not exists 'listening'`,

  `create table if not exists assignment_steps (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references assignments(id) on delete cascade,
    step_no int not null,
    step_type text not null,
    title text,
    items jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    unique (assignment_id, step_no)
  )`,

  `create index if not exists assignment_steps_assignment on assignment_steps(assignment_id)`,

  `create table if not exists assignment_step_submissions (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references assignments(id) on delete cascade,
    step_no int not null,
    student_id uuid not null,
    organization_id uuid not null,
    status submission_status not null default 'pending',
    audio_key text,
    duration_sec int,
    transcript text,
    accuracy_score int,
    pronunciation_score int,
    fluency_score int,
    completion_score int,
    total_score int,
    strengths text,
    improvements text,
    submitted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (assignment_id, step_no, student_id)
  )`,

  `create index if not exists step_subs_org_assignment on assignment_step_submissions(organization_id, assignment_id)`,

  `create index if not exists step_subs_student on assignment_step_submissions(student_id)`,

  `alter table assignment_submissions
    add column if not exists accuracy_score int,
    add column if not exists pronunciation_score int,
    add column if not exists fluency_score int,
    add column if not exists completion_score int,
    add column if not exists duration_sec int,
    add column if not exists listened_at timestamptz`,
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
