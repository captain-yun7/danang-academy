import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { presignGet } from "@/lib/r2/presign";
import { SECTION_ORDER, type Section } from "@/lib/exams/scoring";
import { SectionRunner, type RunnerQuestion } from "./section-runner";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await presignGet(key);
  } catch {
    return null;
  }
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;
  if (!SECTION_ORDER.includes(section as Section)) notFound();
  const sec = section as Section;
  const student = await requireStudent();

  const examRows = (await sql`
    select e.id::text, e.title, e.reading_passage_ko, e.reading_passage_vi
    from exams e
    join students s on s.id = ${student.studentId}::uuid
    where e.id = ${id}::uuid and e.organization_id = ${student.organizationId}
      and e.status = 'published' and e.class_id = s.class_id
    limit 1
  `) as Array<{ id: string; title: string; reading_passage_ko: string | null; reading_passage_vi: string | null }>;
  if (!examRows[0]) notFound();
  const exam = examRows[0];

  const qRows = (await sql`
    select q.id::text, q.prompt_ko, q.prompt_vi, q.choices, q.points, q.audio_key,
           ans.choice_index, ans.answer_text, ans.status as answer_status
    from exam_questions q
    left join exam_attempts a on a.exam_id = q.exam_id and a.student_id = ${student.studentId}::uuid
    left join exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where q.exam_id = ${id}::uuid and q.section = ${sec}
    order by q.order_no
  `) as Array<{
    id: string;
    prompt_ko: string | null;
    prompt_vi: string | null;
    choices: { ko: string; vi: string }[] | null;
    points: number;
    audio_key: string | null;
    choice_index: number | null;
    answer_text: string | null;
    answer_status: string | null;
  }>;

  const questions: RunnerQuestion[] = await Promise.all(
    qRows.map(async (q) => ({
      id: q.id,
      promptKo: q.prompt_ko ?? "",
      promptVi: q.prompt_vi ?? "",
      choices: q.choices ?? [],
      points: q.points,
      audioUrl: await safePresign(q.audio_key),
      savedChoice: q.choice_index,
      savedText: q.answer_text ?? "",
      answerStatus: q.answer_status,
    }))
  );

  const idx = SECTION_ORDER.indexOf(sec);
  const nextSection = idx < SECTION_ORDER.length - 1 ? SECTION_ORDER[idx + 1] : null;

  return (
    <SectionRunner
      examId={id}
      examTitle={exam.title}
      section={sec}
      stepIndex={idx}
      stepTotal={SECTION_ORDER.length}
      nextSection={nextSection}
      passageKo={exam.reading_passage_ko}
      passageVi={exam.reading_passage_vi}
      questions={questions}
    />
  );
}
