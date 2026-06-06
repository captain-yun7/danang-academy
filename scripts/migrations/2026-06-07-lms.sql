-- 발음 연습 + 학습 결과 관리 시스템 (LMS)
-- 학생 로그인 + 과제(발음/쓰기) + 제출/채점
-- 적용: Neon 콘솔 SQL 에디터에서 실행 (멱등 — 재실행 안전)

-- 1) 학생 로그인용 비밀번호 (교사 발급/재설정, null = 로그인 불가)
alter table students add column if not exists password_hash text;

-- 2) enum
do $$ begin
  create type assignment_type as enum ('pronunciation','writing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('pending','processing','completed','failed','submitted','graded');
exception when duplicate_object then null; end $$;

-- 3) 과제
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid,                       -- null = 학원 전체
  type assignment_type not null,
  title text not null,
  instructions text,                   -- 안내문
  target_text text,                    -- 발음: 대화문 / 쓰기: 문제
  tts_audio_key text,                  -- 발음: R2 모범음성 키
  tts_status text,                     -- 'pending' | 'ready' | 'failed'
  due_date date,
  created_by uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists assignments_org_class on assignments(organization_id, class_id);

-- 4) 제출물 (학생 1명당 과제 1행)
create table if not exists assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null,
  organization_id uuid not null,
  status submission_status not null default 'pending',
  -- 발음 AI 결과
  audio_key text,
  transcript text,
  score int,
  strengths text,
  improvements text,
  -- 쓰기 제출/채점
  submission_text text,
  teacher_score int,
  teacher_comment text,
  graded_by uuid,
  graded_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists subs_org_assignment on assignment_submissions(organization_id, assignment_id);
create index if not exists subs_student on assignment_submissions(student_id);
