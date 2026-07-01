-- 주간 4대영역 시험 시스템 (듣기/읽기/쓰기/말하기, 각 100 → 총 400 → 평균 /100)
-- 스펙: _docs/tasks/주말평가기능-20260630/KTalkLab_weekly_test_system.docx
-- v1 온라인시험(exams*)은 보존, 신규는 weekly_ prefix. 적용: POST /api/admin/migrate. 멱등(create only).

create table if not exists weekly_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  lesson_range text,
  status text not null default 'draft',            -- draft | published | closed
  total_score int not null default 400,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists weekly_tests_org on weekly_tests(organization_id, created_at desc);
create index if not exists weekly_tests_class on weekly_tests(class_id);

create table if not exists weekly_sections (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references weekly_tests(id) on delete cascade,
  skill text not null,                             -- listening | reading | writing | speaking
  section_title text not null,
  max_score int not null default 0,
  order_index int not null default 0
);
create index if not exists weekly_sections_test on weekly_sections(test_id, skill, order_index);

create table if not exists weekly_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references weekly_tests(id) on delete cascade,
  section_id uuid not null references weekly_sections(id) on delete cascade,
  skill text not null,
  question_type text not null,                     -- multiple_choice|true_false|matching|fill_blank|arrange_sentence|translation|short_writing|speaking_recording
  question_text text,
  passage_text text,                               -- 읽기 지문 / 듣기 대화(표시용)
  listening_script text,                           -- 듣기 TTS 원문 (학생 비표시)
  audio_key text,                                  -- 생성된 듣기 mp3 R2 키
  tts_status text,                                 -- pending | ready | failed
  options jsonb,                                   -- 선택지 [{ko,vi}] / 연결쌍 등
  correct_answer jsonb,                            -- 정답(인덱스/O·X/배열/문자열)
  points int not null default 0,
  max_play_count int not null default 2,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists weekly_questions_test on weekly_questions(test_id, section_id, order_index);

create table if not exists weekly_answers (
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
  status text not null default 'pending',           -- pending | processing | graded | failed
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (test_id, question_id, student_id)
);
create index if not exists weekly_answers_student on weekly_answers(test_id, student_id);

create table if not exists weekly_results (
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
  status text not null default 'doing',             -- doing | submitted | waiting_writing_review | finalized
  teacher_comment text,
  submitted_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (test_id, student_id)
);
create index if not exists weekly_results_test on weekly_results(test_id);
