-- 기존 학생 학번 일괄 부여 (student_code 가 비어있는 학생만)
-- 형식 YYYY-NNNN. 등록일(enrolled_at) 빠른 순 → 같은 날이면 생성순.
-- 연도는 등록일 기준(없으면 생성일 VN 기준). 학원·연도별로 기존 최대 순번 다음부터 이어붙임.
-- 적용: Neon 콘솔 SQL 에디터에 그대로 실행 (멱등 — 이미 코드 있는 학생은 건드리지 않음)

with existing_max as (
  select organization_id,
         split_part(student_code, '-', 1)::int as yr,
         max(split_part(student_code, '-', 2)::int) as max_seq
  from students
  where student_code ~ '^[0-9]{4}-[0-9]+$'
  group by organization_id, split_part(student_code, '-', 1)::int
),
to_fill as (
  select id,
         organization_id,
         coalesce(
           extract(year from enrolled_at),
           extract(year from (created_at at time zone 'Asia/Ho_Chi_Minh'))
         )::int as yr,
         row_number() over (
           partition by organization_id,
             coalesce(
               extract(year from enrolled_at),
               extract(year from (created_at at time zone 'Asia/Ho_Chi_Minh'))
             )
           order by enrolled_at nulls last, created_at, id
         ) as rn
  from students
  where student_code is null
)
update students s
set student_code = f.yr::text || '-' || lpad((coalesce(m.max_seq, 0) + f.rn)::text, 4, '0')
from to_fill f
left join existing_max m
  on m.organization_id = f.organization_id and m.yr = f.yr
where s.id = f.id;

-- 확인용 (선택): 부여 결과 보기
-- select student_code, name, to_char(enrolled_at,'YYYY-MM-DD') as enrolled
-- from students order by student_code nulls last;
