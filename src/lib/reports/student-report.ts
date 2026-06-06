import { sql } from "@/lib/db/client";

export type ReportHistoryItem = {
  assignmentId: string;
  title: string;
  type: string;
  score: number | null; // 발음=AI score, 쓰기=teacher_score
  date: string | null;
};

export type StudentReport = {
  studentName: string;
  studentCode: string | null;
  status: string;
  pronAvg: number | null;
  writingAvg: number | null;
  completedCount: number;
  totalAssigned: number;
  completionRate: number;
  pronFirst: number | null;
  pronLatest: number | null;
  improvement: number | null;
  history: ReportHistoryItem[];
};

// 학생 1명의 학습 결과를 집계한다. 항상 org 스코프로 호출할 것.
export async function buildStudentReport(
  studentId: string,
  organizationId: string
): Promise<StudentReport | null> {
  const stRows = (await sql`
    select name, student_code, status::text as status, class_id::text
    from students where id = ${studentId} and organization_id = ${organizationId} limit 1
  `) as { name: string; student_code: string | null; status: string; class_id: string | null }[];
  if (!stRows[0]) return null;
  const st = stRows[0];

  // 완료/채점된 제출 이력 (시간순)
  const subs = (await sql`
    select a.id::text as assignment_id, a.title, a.type::text as type,
           s.status::text as status, s.score, s.teacher_score,
           to_char(coalesce(s.graded_at, s.submitted_at, s.updated_at) at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date,
           coalesce(s.graded_at, s.submitted_at, s.updated_at) as ts
    from assignment_submissions s
    join assignments a on a.id = s.assignment_id
    where s.student_id = ${studentId} and s.organization_id = ${organizationId}
    order by ts asc
  `) as {
    assignment_id: string;
    title: string;
    type: string;
    status: string;
    score: number | null;
    teacher_score: number | null;
    date: string | null;
  }[];

  // 본인 대상 활성 과제 총수
  const totalRows = (await sql`
    select count(*)::int as cnt
    from assignments a
    where a.organization_id = ${organizationId} and a.active = true
      and (a.class_id is null or a.class_id = ${st.class_id}::uuid)
  `) as { cnt: number }[];
  const totalAssigned = totalRows[0]?.cnt ?? 0;

  const pronScores = subs
    .filter((s) => s.type === "pronunciation" && s.status === "completed" && s.score !== null)
    .map((s) => s.score as number);
  const writingScores = subs
    .filter((s) => s.type === "writing" && s.status === "graded" && s.teacher_score !== null)
    .map((s) => s.teacher_score as number);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const pronFirst = pronScores.length ? pronScores[0] : null;
  const pronLatest = pronScores.length ? pronScores[pronScores.length - 1] : null;
  const improvement =
    pronFirst !== null && pronLatest !== null ? pronLatest - pronFirst : null;

  const history: ReportHistoryItem[] = subs
    .filter((s) => s.status === "completed" || s.status === "graded")
    .map((s) => ({
      assignmentId: s.assignment_id,
      title: s.title,
      type: s.type,
      score: s.type === "pronunciation" ? s.score : s.teacher_score,
      date: s.date,
    }));

  const completedCount = history.length;

  return {
    studentName: st.name,
    studentCode: st.student_code,
    status: st.status,
    pronAvg: avg(pronScores),
    writingAvg: avg(writingScores),
    completedCount,
    totalAssigned,
    completionRate: totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0,
    pronFirst,
    pronLatest,
    improvement,
    history,
  };
}
