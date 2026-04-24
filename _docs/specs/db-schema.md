# DB 스키마 (Supabase / PostgreSQL)

> MVP 범위. Phase 2/3 테이블은 주석으로만 표기.
> 실제 SQL은 `./_docs/runbook/init.sql` 참조.

## 공통 규칙
- 모든 테이블 PK: `id uuid default gen_random_uuid()`
- 모든 테이블: `created_at timestamptz default now()`, `updated_at timestamptz default now()` (트리거로 관리)
- 삭제는 soft delete 지양 (MVP 단계) — 필요 시 `deleted_at` 추가

## Enum 타입
```sql
create type user_role as enum
  ('super_admin','owner','manager','teacher','student','visitor');

create type korean_level as enum
  ('beginner','elementary','intermediate','advanced'); -- 입문/초급/중급/고급

create type native_language as enum
  ('vi','en','other');

create type test_status as enum
  ('pending','processing','completed','failed');

create type attendance_kind as enum
  ('check_in','check_out');
```

## 1. `users` (SUPER_ADMIN / OWNER / MANAGER / TEACHER)
> Supabase Auth와 1:1 연동. `auth.users.id` = `users.id`.

```sql
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'manager',
  name text not null,
  email text unique,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 2. `students`
```sql
create table students (
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
create index on students(class_id);
create index on students(qr_token);
```

## 3. `classes`
```sql
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,                     -- 예: "중급반 A"
  level korean_level not null,
  teacher_id uuid references users(id),
  schedule text,                          -- "월수금 19:00" 등
  capacity int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 4. `attendance_logs` (QR 입출석)
```sql
create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind attendance_kind not null,
  logged_at timestamptz default now(),
  class_id uuid references classes(id),
  note text
);
create index on attendance_logs(student_id, logged_at desc);
create index on attendance_logs(logged_at);
```

## 5. `sentences` (발음 테스트용 문장 마스터)
```sql
create table sentences (
  id uuid primary key default gen_random_uuid(),
  level korean_level not null,
  text text not null,
  created_at timestamptz default now()
);
create index on sentences(level);
```

## 6. `free_pronunciation_tests` (무료 발음 테스트)
> Glide의 `FreePronunciationRequests` 시트 이식.

```sql
create table free_pronunciation_tests (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,             -- 비회원 이름/별명
  visitor_fingerprint text,               -- IP+UA 해시 또는 익명 세션 토큰 (하루 5회 제한용)
  native_language native_language not null,
  korean_level korean_level not null,     -- 유저가 선택한 수준
  target_sentence text not null,
  audio_url text,                         -- Supabase Storage URL
  transcript text,                        -- 워커가 STT 결과 기록
  score int,                              -- 0~100
  strengths text,                         -- 좋은 점
  improvements text,                      -- 개선점
  recommended_class_level korean_level,   -- 추천 반
  status test_status not null default 'pending',
  consulted_at timestamptz,               -- 상담 전환 시각 (null이면 미전환)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on free_pronunciation_tests(status, created_at);
create index on free_pronunciation_tests(visitor_fingerprint, created_at);
```

## 7. `placement_tests` (무료 반배정 테스트)
```sql
create table placement_tests (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  visitor_fingerprint text,
  native_language native_language not null,
  -- 객관식 5문항
  mcq_answers jsonb not null,             -- [{qid, answer, correct}]
  mcq_score int not null,
  -- 발음 1문장
  pronunciation_test_id uuid references free_pronunciation_tests(id),
  -- 결과
  recommended_level korean_level,
  status test_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 8. `consult_leads` (상담 리드)
```sql
create table consult_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,                            -- 'landing', 'pronunciation_test', 'placement_test'
  source_test_id uuid,                    -- 테스트에서 온 경우 참조
  recommended_level korean_level,
  status text default 'new',              -- new/contacted/enrolled/dropped
  note text,
  assigned_to uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on consult_leads(status);
```

## Phase 2/3 예정 (아직 생성 X)
- `weekly_reports` — 주간 리포트
- `writing_tests` — 작문 평가 (TOPIK)
- `homework_submissions` — 복습 녹음 제출

## RLS (Row Level Security) 방향
- `students`, `classes`, `attendance_logs`, `users`: 기본 deny, 로그인 사용자만 역할별 정책
- `free_pronunciation_tests`, `placement_tests`, `consult_leads`: 익명 insert 허용 (anon role), select/update는 관리자만
- `sentences`: 로그인 사용자만 select 허용 (랜덤 문장은 서버 사이드에서 뽑아서 반환)

## 제출 제한 (Glide → 서버 이식)
- 익명 방문자: IP+UA fingerprint 기준 하루 5회
- 구현 위치: 서버 액션 또는 API 라우트에서 `count(*)` 체크 후 insert
- 장기적으로는 Upstash Redis(rate limit)로 이동
