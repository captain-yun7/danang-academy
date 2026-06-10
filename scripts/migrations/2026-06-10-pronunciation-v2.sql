-- 발음 과제 v2: listening 타입 + 단계별 과제(steps) + 단계별 제출 + 세부 점수
-- 적용: POST /api/admin/migrate (owner/manager) 또는 Neon 콘솔 SQL 에디터
-- 멱등 — 재실행 안전. 각 statement는 단독 실행 가능 (alter type add value는 트랜잭션 밖 필수)

alter type assignment_type add value if not exists 'listening';

-- 과제 단계: word → phrase → sentence → passage
create table if not exists assignment_steps (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  step_no int not null,
  step_type text not null,  -- 'word' | 'phrase' | 'sentence' | 'passage'
  title text,
  items jsonb not null default '[]'::jsonb,  -- [{ "text": str, "ttsKey": str|null, "ttsStatus": "pending"|"ready"|"failed" }]
  created_at timestamptz not null default now(),
  unique (assignment_id, step_no)
);

create index if not exists assignment_steps_assignment on assignment_steps(assignment_id);

-- 단계별 제출 (학생 1명당 단계 1행)
create table if not exists assignment_step_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  step_no int not null,
  student_id uuid not null,
  organization_id uuid not null,
  status submission_status not null default 'pending',
  audio_key text,
  duration_sec int,
  transcript text,
  accuracy_score int,        -- 정확도 0~40
  pronunciation_score int,   -- 발음 0~30
  fluency_score int,         -- 유창성 0~20
  completion_score int,      -- 완성도 0~10
  total_score int,           -- 합계 0~100
  strengths text,
  improvements text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, step_no, student_id)
);

create index if not exists step_subs_org_assignment on assignment_step_submissions(organization_id, assignment_id);

create index if not exists step_subs_student on assignment_step_submissions(student_id);

-- 기존 집계 테이블에 세부 점수 컬럼 추가
alter table assignment_submissions
  add column if not exists accuracy_score int,
  add column if not exists pronunciation_score int,
  add column if not exists fluency_score int,
  add column if not exists completion_score int,
  add column if not exists duration_sec int,
  add column if not exists listened_at timestamptz;
