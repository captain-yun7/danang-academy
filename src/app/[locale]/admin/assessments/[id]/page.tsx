import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { DEFAULT_CUTS, type AreaScores, type GradeCuts } from "@/lib/assessments/scoring";
import { RoundDetail, type RoundStudent } from "./round-detail";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rounds = (await sql`
    select r.id::text, r.title, r.class_id::text,
           c.name as class_name,
           to_char(r.assessment_date, 'YYYY-MM-DD') as date,
           r.pronunciation_assignment_id::text as pron_id,
           r.writing_assignment_id::text as writing_id,
           pa.title as pron_title,
           wa.title as writing_title
    from assessment_rounds r
    join classes c on c.id = r.class_id
    left join assignments pa on pa.id = r.pronunciation_assignment_id
    left join assignments wa on wa.id = r.writing_assignment_id
    where r.id = ${id}::uuid and r.organization_id = ${orgId}
    limit 1
  `) as {
    id: string;
    title: string;
    class_id: string;
    class_name: string;
    date: string;
    pron_id: string | null;
    writing_id: string | null;
    pron_title: string | null;
    writing_title: string | null;
  }[];
  if (!rounds[0]) notFound();
  const round = rounds[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${orgId} limit 1
  `) as GradeCuts[];
  const cuts: GradeCuts = cutRows[0] ?? DEFAULT_CUTS;

  // 연결 과제 제출/채점 현황 (반 학생 기준)
  const rosterCountRow = (await sql`
    select count(*)::int as cnt from students
    where class_id = ${round.class_id}::uuid and organization_id = ${orgId}
  `) as { cnt: number }[];
  const rosterCount = rosterCountRow[0]?.cnt ?? 0;

  async function assignmentDone(assignmentId: string, doneStatus: string) {
    const rows = (await sql`
      select count(*)::int as cnt
      from assignment_submissions sub
      join students s on s.id = sub.student_id
      where sub.assignment_id = ${assignmentId}::uuid
        and s.class_id = ${round.class_id}::uuid
        and sub.organization_id = ${orgId}
        and sub.status = ${doneStatus}
    `) as { cnt: number }[];
    return rows[0]?.cnt ?? 0;
  }

  const linked = {
    pronunciation: round.pron_id
      ? { title: round.pron_title ?? "(삭제된 과제)", done: await assignmentDone(round.pron_id, "completed"), total: rosterCount, href: `/admin/assignments/${round.pron_id}` }
      : null,
    writing: round.writing_id
      ? { title: round.writing_title ?? "(삭제된 과제)", done: await assignmentDone(round.writing_id, "graded"), total: rosterCount, href: `/admin/assignments/${round.writing_id}` }
      : null,
  };

  // 그 주 출석 요약 (assessment_date 가 속한 주, 월~일, VN tz) — attendance_logs check_in 기준
  const attRows = (await sql`
    select count(distinct al.student_id)::int as students,
           count(distinct (al.student_id, (al.logged_at at time zone 'Asia/Ho_Chi_Minh')::date))::int as student_days
    from attendance_logs al
    where al.class_id = ${round.class_id}::uuid
      and al.organization_id = ${orgId}
      and al.kind = 'check_in'
      and (al.logged_at at time zone 'Asia/Ho_Chi_Minh')::date
          >= date_trunc('week', ${round.date}::date)::date
      and (al.logged_at at time zone 'Asia/Ho_Chi_Minh')::date
          <  (date_trunc('week', ${round.date}::date) + interval '7 days')::date
  `) as { students: number; student_days: number }[];
  const attendance = { students: attRows[0]?.students ?? 0, studentDays: attRows[0]?.student_days ?? 0, roster: rosterCount };

  // 반 학생 명단 + 점수 (left join)
  const roster = (await sql`
    select s.id::text, s.name, s.student_code,
           sc.listening_score, sc.speaking_score, sc.reading_score, sc.writing_score, sc.pronunciation_score,
           sc.parent_comment
    from students s
    left join assessment_scores sc
      on sc.student_id = s.id and sc.round_id = ${id}::uuid
    where s.class_id = ${round.class_id}::uuid and s.organization_id = ${orgId}
    order by s.name
  `) as Array<{
    id: string;
    name: string;
    student_code: string | null;
    listening_score: number | null;
    speaking_score: number | null;
    reading_score: number | null;
    writing_score: number | null;
    pronunciation_score: number | null;
    parent_comment: string | null;
  }>;

  const students: RoundStudent[] = roster.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.student_code,
    scores: {
      listening: r.listening_score,
      speaking: r.speaking_score,
      reading: r.reading_score,
      writing: r.writing_score,
      pronunciation: r.pronunciation_score,
    } as AreaScores,
    hasComment: !!r.parent_comment,
  }));

  return (
    <RoundDetail
      roundId={round.id}
      title={round.title}
      className={round.class_name}
      date={round.date}
      students={students}
      cuts={cuts}
      linked={linked}
      attendance={attendance}
    />
  );
}
