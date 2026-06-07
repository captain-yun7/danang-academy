-- 과제 배정 대상 확장: 학원 전체 / 특정 반 / 개별 학생
-- 적용: Neon 콘솔 SQL 에디터에서 실행 (멱등 — 재실행 안전)

-- target_type: 'all'(학원 전체) | 'class'(특정 반, class_id 사용) | 'students'(개별, assignment_targets 사용)
alter table assignments add column if not exists target_type text not null default 'all';

-- 기존 데이터 보정: 반이 지정돼 있던 과제는 'class' 로
update assignments set target_type = 'class'
where class_id is not null and target_type = 'all';

-- 개별 배정 학생 목록
create table if not exists assignment_targets (
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null,
  organization_id uuid not null,
  primary key (assignment_id, student_id)
);
create index if not exists assignment_targets_student on assignment_targets(student_id);
