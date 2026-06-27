-- 주말 평가: 평가 회차 + 학생별 영역 점수 + 등급 컷 설정
-- 적용: POST /api/admin/migrate (owner/manager) 또는 Neon 콘솔 SQL 에디터
-- 멱등 — 재실행 안전. 각 statement 단독 실행 가능 (neon http 드라이버는 statement 1개씩).

-- 평가 회차 (반 × 주차)
create table if not exists assessment_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  assessment_date date not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists assessment_rounds_org on assessment_rounds(organization_id, assessment_date desc);

create index if not exists assessment_rounds_class on assessment_rounds(class_id);

-- 학생별 영역 점수 (회차 × 학생 1행)
create table if not exists assessment_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references assessment_rounds(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  organization_id uuid not null,
  listening_score int,        -- 듣기 0~100 (수동)
  speaking_score int,         -- 말하기 0~100 (수동)
  reading_score int,          -- 읽기 0~100 (수동)
  writing_score int,          -- 쓰기 0~100 (수동)
  pronunciation_score int,    -- 발음 0~100 (시스템 자동 + 수정)
  parent_comment text,        -- 학부모 코멘트 (AI 초안 + 교사 수정)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, student_id)
);

create index if not exists assessment_scores_round on assessment_scores(round_id);

create index if not exists assessment_scores_student on assessment_scores(student_id);

-- 등급 컷 설정 (조직 단위). 기본 90/75/60.
alter table organizations
  add column if not exists grade_cut_excellent int not null default 90,
  add column if not exists grade_cut_good int not null default 75,
  add column if not exists grade_cut_normal int not null default 60;
