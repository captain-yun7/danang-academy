import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { ExamEditor, type EditorExam, type EditorQuestion } from "./exam-editor";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await presignGet(key);
  } catch {
    return null;
  }
}

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select e.id::text, e.title, c.name as class_name,
           to_char(e.exam_date, 'YYYY-MM-DD') as date, e.status,
           e.w_listening, e.w_reading, e.w_grammar, e.w_writing, e.w_speaking,
           e.reading_passage_ko, e.reading_passage_vi
    from exams e join classes c on c.id = e.class_id
    where e.id = ${id}::uuid and e.organization_id = ${orgId} limit 1
  `) as Array<{
    id: string;
    title: string;
    class_name: string;
    date: string;
    status: string;
    w_listening: number;
    w_reading: number;
    w_grammar: number;
    w_writing: number;
    w_speaking: number;
    reading_passage_ko: string | null;
    reading_passage_vi: string | null;
  }>;
  if (!rows[0]) notFound();
  const e = rows[0];

  const qRows = (await sql`
    select id::text, section, order_no, prompt_ko, prompt_vi, choices, answer_index, points, audio_key
    from exam_questions where exam_id = ${id}::uuid
    order by section, order_no
  `) as Array<{
    id: string;
    section: string;
    order_no: number;
    prompt_ko: string | null;
    prompt_vi: string | null;
    choices: { ko: string; vi: string }[] | null;
    answer_index: number | null;
    points: number;
    audio_key: string | null;
  }>;

  const questions: EditorQuestion[] = await Promise.all(
    qRows.map(async (q) => ({
      id: q.id,
      section: q.section as EditorQuestion["section"],
      promptKo: q.prompt_ko ?? "",
      promptVi: q.prompt_vi ?? "",
      choices: q.choices ?? [],
      answerIndex: q.answer_index,
      points: q.points,
      audioKey: q.audio_key,
      audioUrl: await safePresign(q.audio_key),
    }))
  );

  const exam: EditorExam = {
    id: e.id,
    title: e.title,
    className: e.class_name,
    date: e.date,
    status: e.status,
    weights: {
      w_listening: e.w_listening,
      w_reading: e.w_reading,
      w_grammar: e.w_grammar,
      w_writing: e.w_writing,
      w_speaking: e.w_speaking,
    },
    passageKo: e.reading_passage_ko ?? "",
    passageVi: e.reading_passage_vi ?? "",
  };

  return <ExamEditor exam={exam} questions={questions} />;
}
