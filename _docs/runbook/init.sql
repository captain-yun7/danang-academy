-- Da Nang K-Talk Lab — 초기 스키마
-- Supabase SQL Editor에서 실행
-- 참조: _docs/specs/db-schema.md

-- =============================================================
-- Extensions
-- =============================================================
create extension if not exists pgcrypto;

-- =============================================================
-- Enums
-- =============================================================
do $$ begin
  create type user_role as enum ('super_admin','owner','manager','teacher','student','visitor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type korean_level as enum ('beginner','elementary','intermediate','advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type native_language as enum ('vi','en','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type test_status as enum ('pending','processing','completed','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_kind as enum ('check_in','check_out');
exception when duplicate_object then null; end $$;

-- =============================================================
-- updated_at trigger helper
-- =============================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

-- =============================================================
-- users (Supabase Auth 연동)
-- =============================================================
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'manager',
  name text not null,
  email text unique,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

-- =============================================================
-- classes
-- =============================================================
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level korean_level not null,
  teacher_id uuid references users(id),
  schedule text,
  capacity int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists trg_classes_updated_at on classes;
create trigger trg_classes_updated_at before update on classes
  for each row execute function set_updated_at();

-- =============================================================
-- students
-- =============================================================
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  native_language native_language not null default 'vi',
  korean_level korean_level,
  class_id uuid references classes(id) on delete set null,
  qr_token text unique not null default encode(gen_random_bytes(16),'hex'),
  parent_contact text,
  enrolled_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_students_class_id on students(class_id);
create index if not exists idx_students_qr_token on students(qr_token);
drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

-- =============================================================
-- attendance_logs (QR)
-- =============================================================
create table if not exists attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind attendance_kind not null,
  logged_at timestamptz default now(),
  class_id uuid references classes(id),
  note text
);
create index if not exists idx_att_student_logged on attendance_logs(student_id, logged_at desc);
create index if not exists idx_att_logged_at on attendance_logs(logged_at);

-- =============================================================
-- sentences (발음 테스트 문장 마스터)
-- =============================================================
create table if not exists sentences (
  id uuid primary key default gen_random_uuid(),
  level korean_level not null,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists idx_sentences_level on sentences(level);

-- =============================================================
-- free_pronunciation_tests (Glide FreePronunciationRequests 이식)
-- =============================================================
create table if not exists free_pronunciation_tests (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  visitor_fingerprint text,
  native_language native_language not null,
  korean_level korean_level not null,
  target_sentence text not null,
  audio_url text,
  transcript text,
  score int,
  strengths text,
  improvements text,
  recommended_class_level korean_level,
  status test_status not null default 'pending',
  consulted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fpt_status_created on free_pronunciation_tests(status, created_at);
create index if not exists idx_fpt_fingerprint on free_pronunciation_tests(visitor_fingerprint, created_at);
drop trigger if exists trg_fpt_updated_at on free_pronunciation_tests;
create trigger trg_fpt_updated_at before update on free_pronunciation_tests
  for each row execute function set_updated_at();

-- =============================================================
-- placement_tests (반배정 테스트)
-- =============================================================
create table if not exists placement_tests (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  visitor_fingerprint text,
  native_language native_language not null,
  mcq_answers jsonb not null,
  mcq_score int not null,
  pronunciation_test_id uuid references free_pronunciation_tests(id),
  recommended_level korean_level,
  status test_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists trg_pt_updated_at on placement_tests;
create trigger trg_pt_updated_at before update on placement_tests
  for each row execute function set_updated_at();

-- =============================================================
-- consult_leads (상담 리드)
-- =============================================================
create table if not exists consult_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,
  source_test_id uuid,
  recommended_level korean_level,
  status text default 'new',
  note text,
  assigned_to uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_leads_status on consult_leads(status);
drop trigger if exists trg_leads_updated_at on consult_leads;
create trigger trg_leads_updated_at before update on consult_leads
  for each row execute function set_updated_at();

-- =============================================================
-- seed: 문장 샘플 (나중에 원본 시트에서 이관)
-- =============================================================
insert into sentences (level, text) values
  ('beginner', '안녕하세요.'),
  ('beginner', '감사합니다.'),
  ('elementary', '오늘 날씨가 정말 좋아요.'),
  ('elementary', '이 음식은 정말 맛있어요.'),
  ('intermediate', '베트남에서 한국어를 공부한 지 얼마나 되셨어요?'),
  ('intermediate', '다낭의 바다는 정말 아름답다고 생각해요.'),
  ('advanced', '언어를 제대로 배우려면 문화도 함께 이해하는 것이 중요합니다.'),
  ('advanced', '발음을 자연스럽게 하려면 꾸준한 연습이 필요하다고 봅니다.')
on conflict do nothing;
