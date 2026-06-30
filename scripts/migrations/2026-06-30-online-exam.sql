-- 온라인 주말 복습 시험: 출제 → 학생 응시 → 자동채점 → 보고서
-- 적용: POST /api/admin/migrate (owner/manager) 또는 Neon 콘솔. 멱등 — 재실행 안전.

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  exam_date date not null,
  status text not null default 'draft',          -- draft | published | closed
  reading_passage_ko text,
  reading_passage_vi text,
  w_listening int not null default 20,
  w_reading int not null default 20,
  w_grammar int not null default 30,
  w_writing int not null default 15,
  w_speaking int not null default 15,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists exams_org on exams(organization_id, exam_date desc);
create index if not exists exams_class on exams(class_id);

create table if not exists exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  section text not null,                          -- listening | reading | grammar_vocab | writing | speaking
  order_no int not null default 0,
  prompt_ko text,
  prompt_vi text,
  choices jsonb,                                  -- MCQ: [{ "ko": str, "vi": str }]
  answer_index int,                               -- MCQ 정답 인덱스
  points int not null default 0,
  audio_key text,                                 -- 듣기 음성 R2 키
  created_at timestamptz not null default now()
);

create index if not exists exam_questions_exam on exam_questions(exam_id, section, order_no);

create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  organization_id uuid not null,
  status text not null default 'in_progress',     -- in_progress | submitted | completed
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
);

create index if not exists exam_attempts_exam on exam_attempts(exam_id);
create index if not exists exam_attempts_student on exam_attempts(student_id);

create table if not exists exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references exam_attempts(id) on delete cascade,
  question_id uuid not null references exam_questions(id) on delete cascade,
  organization_id uuid not null,
  choice_index int,                               -- MCQ 선택
  answer_text text,                               -- 쓰기 제출
  audio_key text,                                 -- 말하기 녹음 R2 키
  transcript text,                                -- 말하기 STT
  awarded_points int,                             -- 채점 결과 점수
  ai_score int,
  ai_feedback text,
  teacher_score int,
  teacher_comment text,
  status text not null default 'pending',         -- pending | processing | graded | failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists exam_answers_attempt on exam_answers(attempt_id);
