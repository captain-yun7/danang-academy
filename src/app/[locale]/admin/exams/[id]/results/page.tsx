import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { DEFAULT_CUTS, type GradeCuts, type Skill } from "@/lib/exams/scoring";
import { ResultsView, type ResultRow, type WritingAns, type SpeakingAns } from "./results-view";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try { return await presignGet(key); } catch { return null; }
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const tRows = (await sql`
    select t.title, c.name as class_name, t.lesson_range
    from weekly_tests t join classes c on c.id = t.class_id
    where t.id = ${id}::uuid and t.organization_id = ${orgId} limit 1
  `) as { title: string; class_name: string; lesson_range: string | null }[];
  if (!tRows[0]) notFound();

  const cutRows = (await sql`select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal from organizations where id = ${orgId} limit 1`) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  const rRows = (await sql`
    select r.student_id::text, st.name, st.student_code, r.status, r.total_score, r.average_score, r.teacher_comment,
           r.listening_score, r.reading_score, r.writing_final_score, r.speaking_score
    from weekly_results r join students st on st.id = r.student_id
    where r.test_id = ${id}::uuid and r.organization_id = ${orgId}
    order by r.total_score desc nulls last
  `) as Array<Record<string, string | number | null>>;
  const results: ResultRow[] = rRows.map((r) => ({
    studentId: r.student_id as string, name: r.name as string, code: (r.student_code as string | null) ?? null,
    status: r.status as string, total: (r.total_score as number | null) ?? null, average: r.average_score != null ? Number(r.average_score) : null,
    comment: (r.teacher_comment as string | null) ?? "",
    skills: { listening: r.listening_score as number | null, reading: r.reading_score as number | null, writing: r.writing_final_score as number | null, speaking: r.speaking_score as number | null } as Record<Skill, number | null>,
  }));

  const wRows = (await sql`
    select a.id::text, a.student_id::text, q.question_text, q.points, a.answer_text, a.ai_score, a.ai_feedback, a.teacher_score
    from weekly_answers a join weekly_questions q on q.id = a.question_id
    where a.test_id = ${id}::uuid and q.skill = 'writing' and q.question_type in ('translation','short_writing') and a.organization_id = ${orgId}
  `) as Array<{ id: string; student_id: string; question_text: string | null; points: number; answer_text: string | null; ai_score: number | null; ai_feedback: string | null; teacher_score: number | null }>;
  const writing: WritingAns[] = wRows.map((w) => ({ answerId: w.id, studentId: w.student_id, prompt: w.question_text ?? "", maxPoints: w.points, text: w.answer_text ?? "", aiScore: w.ai_score, aiFeedback: w.ai_feedback ?? "", teacherScore: w.teacher_score }));

  const sRows = (await sql`
    select a.student_id::text, q.question_text, a.audio_answer_url, a.transcript, a.final_score, a.ai_feedback, a.status
    from weekly_answers a join weekly_questions q on q.id = a.question_id
    where a.test_id = ${id}::uuid and q.skill = 'speaking' and a.organization_id = ${orgId}
  `) as Array<{ student_id: string; question_text: string | null; audio_answer_url: string | null; transcript: string | null; final_score: number | null; ai_feedback: string | null; status: string }>;
  const speaking: SpeakingAns[] = await Promise.all(sRows.map(async (s) => ({ studentId: s.student_id, prompt: s.question_text ?? "", audioUrl: await safePresign(s.audio_answer_url), transcript: s.transcript ?? "", awarded: s.final_score, feedback: s.ai_feedback ?? "", status: s.status })));

  return <ResultsView testId={id} title={tRows[0].title} className={tRows[0].class_name} lessonRange={tRows[0].lesson_range} cuts={cuts} results={results} writing={writing} speaking={speaking} />;
}
