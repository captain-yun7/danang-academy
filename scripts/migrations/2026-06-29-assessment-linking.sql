-- 주말 평가 v2: 회차에 발음/쓰기 과제 연결 (점수 자동 동기화 출처)
-- 적용: POST /api/admin/migrate (owner/manager) 또는 Neon 콘솔. 멱등 — 재실행 안전.

alter table assessment_rounds
  add column if not exists pronunciation_assignment_id uuid references assignments(id) on delete set null,
  add column if not exists writing_assignment_id uuid references assignments(id) on delete set null;
