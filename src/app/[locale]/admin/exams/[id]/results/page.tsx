import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { DEFAULT_CUTS, type GradeCuts, type Section } from "@/lib/exams/scoring";
import { ResultsView, type AttemptRow, type WritingAns, type SpeakingAns } from "./results-view";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await presignGet(key);
  } catch {
    return null;
  }
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const examRows = (await sql`
    select e.id::text, e.title, c.name as class_name, to_char(e.exam_date,'YYYY-MM-DD') as date,
           e.w_listening, e.w_reading, e.w_grammar, e.w_writing, e.w_speaking
    from exams e join classes c on c.id = e.class_id
    where e.id = ${id}::uuid and e.organization_id = ${orgId} limit 1
  `) as Array<Record<string, string | number>>;
  if (!examRows[0]) notFound();
  const e = examRows[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${orgId} limit 1
  `) as GradeCuts[];
  const cuts = cutRows[0] ?? DEFAULT_CUTS;

  const attempts = (await sql`
    select a.id::text, st.name, st.student_code, a.status, a.total_score, a.parent_comment,
           a.listening_score, a.reading_score, a.grammar_vocab_score, a.writing_score, a.speaking_score
    from exam_attempts a join students st on st.id = a.student_id
    where a.exam_id = ${id}::uuid and a.organization_id = ${orgId}
    order by a.total_score desc nulls last
  `) as Array<Record<string, string | number | null>>;

  const attemptRows: AttemptRow[] = attempts.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    code: (a.student_code as string | null) ?? null,
    status: a.status as string,
    total: (a.total_score as number | null) ?? null,
    comment: (a.parent_comment as string | null) ?? "",
    sections: {
      listening: a.listening_score as number | null,
      reading: a.reading_score as number | null,
      grammar_vocab: a.grammar_vocab_score as number | null,
      writing: a.writing_score as number | null,
      speaking: a.speaking_score as number | null,
    } as Record<Section, number | null>,
  }));

  const wRows = (await sql`
    select ans.id::text, ans.attempt_id::text, q.prompt_ko, q.points,
           ans.answer_text, ans.ai_score, ans.ai_feedback, ans.teacher_score
    from exam_answers ans
    join exam_questions q on q.id = ans.question_id
    join exam_attempts a on a.id = ans.attempt_id
    where a.exam_id = ${id}::uuid and q.section = 'writing' and ans.organization_id = ${orgId}
  `) as Array<{
    id: string; attempt_id: string; prompt_ko: string | null; points: number;
    answer_text: string | null; ai_score: number | null; ai_feedback: string | null; teacher_score: number | null;
  }>;
  const writing: WritingAns[] = wRows.map((w) => ({
    answerId: w.id, attemptId: w.attempt_id, prompt: w.prompt_ko ?? "", maxPoints: w.points,
    text: w.answer_text ?? "", aiScore: w.ai_score, aiFeedback: w.ai_feedback ?? "", teacherScore: w.teacher_score,
  }));

  const sRows = (await sql`
    select ans.attempt_id::text, q.prompt_ko, q.points, ans.audio_key, ans.transcript, ans.awarded_points, ans.ai_feedback, ans.status
    from exam_answers ans
    join exam_questions q on q.id = ans.question_id
    join exam_attempts a on a.id = ans.attempt_id
    where a.exam_id = ${id}::uuid and q.section = 'speaking' and ans.organization_id = ${orgId}
  `) as Array<{
    attempt_id: string; prompt_ko: string | null; points: number; audio_key: string | null;
    transcript: string | null; awarded_points: number | null; ai_feedback: string | null; status: string;
  }>;
  const speaking: SpeakingAns[] = await Promise.all(
    sRows.map(async (s) => ({
      attemptId: s.attempt_id, prompt: s.prompt_ko ?? "", maxPoints: s.points,
      audioUrl: await safePresign(s.audio_key), transcript: s.transcript ?? "",
      awarded: s.awarded_points, feedback: s.ai_feedback ?? "", status: s.status,
    }))
  );

  return (
    <ResultsView
      examId={id}
      title={e.title as string}
      className={e.class_name as string}
      date={e.date as string}
      cuts={cuts}
      attempts={attemptRows}
      writing={writing}
      speaking={speaking}
    />
  );
}
