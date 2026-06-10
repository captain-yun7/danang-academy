-- 출석 플로우 모의 테스트용 최소 스키마 + 시드 (로컬 전용 — 프로덕션 적용 금지)
create extension if not exists pgcrypto;

do $$ begin
  create type session_attendance_status as enum ('present', 'late', 'absent', 'excused');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat numeric,
  lng numeric,
  gps_radius_m int not null default 150
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  qr_token text unique,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  class_id uuid references classes(id),
  name text not null,
  student_code text,
  status text not null default 'waiting',
  enrolled_at date
);

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  class_id uuid not null references classes(id),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled'
);

create table if not exists session_attendance (
  session_id uuid not null references class_sessions(id),
  student_id uuid not null references students(id),
  organization_id uuid not null,
  status session_attendance_status not null,
  marked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists attendance_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid,
  session_id uuid,
  student_id uuid,
  device_fp text,
  ip text,
  lat numeric,
  lng numeric,
  result text not null,
  message text,
  created_at timestamptz not null default now()
);

-- ===== 시드 =====
insert into organizations (id, name, lat, lng, gps_radius_m) values
  ('00000000-0000-0000-0000-000000000001', '다프 테스트', 16.04111, 108.21778, 150);

insert into classes (id, organization_id, name, qr_token) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Lớp nhập môn giao tiếp sáng (TEST)', 'mocktesttoken1234567890abcdef');

insert into students (organization_id, class_id, name, student_code, status, enrolled_at) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'Bảo Hân', '2026-0001', 'waiting', '2026-05-20'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'Lê Quyên', '2026-0009', 'active', '2026-06-06'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'Hưu Học Sinh', '2026-0099', 'paused', '2026-05-01');

-- 지금 (VN) 진행 중인 회차: VN 현재 시각 기준 -20분 ~ +70분
insert into class_sessions (organization_id, class_id, session_date, start_time, end_time)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  ((now() at time zone 'Asia/Ho_Chi_Minh') - interval '20 minutes')::time,
  ((now() at time zone 'Asia/Ho_Chi_Minh') + interval '70 minutes')::time
);
