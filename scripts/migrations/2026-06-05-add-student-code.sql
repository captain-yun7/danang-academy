-- 학생 학번(학생 코드) 컬럼 추가
-- 과제 제출 파일명 규칙으로 사용. 형식 예: 2026-0001 (연도-순번)
-- 적용: Neon MCP prepare_database_migration → complete_database_migration
--       또는 psql "$DATABASE_URL_UNPOOLED" -f scripts/migrations/2026-06-05-add-student-code.sql

alter table students add column if not exists student_code text;

-- 학원 단위로 학번 중복 방지 (null 은 허용)
create unique index if not exists students_org_student_code_uniq
  on students (organization_id, student_code)
  where student_code is not null;
