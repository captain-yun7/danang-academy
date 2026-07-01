import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { TestEditor, type EditorTest, type EditorSection, type EditorQuestion } from "./exam-editor";
import type { QuestionType, Skill } from "@/lib/exams/scoring";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try { return await presignGet(key); } catch { return null; }
}

export default async function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select t.id::text, t.title, t.lesson_range, c.name as class_name, t.status
    from weekly_tests t join classes c on c.id = t.class_id
    where t.id = ${id}::uuid and t.organization_id = ${orgId} limit 1
  `) as { id: string; title: string; lesson_range: string | null; class_name: string; status: string }[];
  if (!rows[0]) notFound();
  const t = rows[0];

  const sRows = (await sql`
    select id::text, skill, section_title, max_score, order_index
    from weekly_sections where test_id = ${id}::uuid order by skill, order_index
  `) as { id: string; skill: string; section_title: string; max_score: number; order_index: number }[];

  const qRows = (await sql`
    select id::text, section_id::text, skill, question_type, question_text, passage_text, listening_script,
           audio_key, tts_status, options, correct_answer, points, max_play_count, order_index
    from weekly_questions where test_id = ${id}::uuid order by order_index
  `) as Array<{
    id: string; section_id: string; skill: string; question_type: string;
    question_text: string | null; passage_text: string | null; listening_script: string | null;
    audio_key: string | null; tts_status: string | null; options: unknown; correct_answer: unknown;
    points: number; max_play_count: number; order_index: number;
  }>;

  const questions: EditorQuestion[] = await Promise.all(qRows.map(async (q) => ({
    id: q.id,
    sectionId: q.section_id,
    skill: q.skill as Skill,
    questionType: q.question_type as QuestionType,
    questionText: q.question_text ?? "",
    passageText: q.passage_text ?? "",
    listeningScript: q.listening_script ?? "",
    ttsStatus: q.tts_status,
    audioUrl: await safePresign(q.audio_key),
    options: (q.options as { ko: string; vi: string }[] | null) ?? [],
    correctAnswer: q.correct_answer ?? null,
    points: q.points,
    maxPlayCount: q.max_play_count,
  })));

  const sections: EditorSection[] = sRows.map((s) => ({
    id: s.id, skill: s.skill as Skill, title: s.section_title, maxScore: s.max_score,
  }));

  const test: EditorTest = { id: t.id, title: t.title, lessonRange: t.lesson_range, className: t.class_name, status: t.status };

  return <TestEditor test={test} sections={sections} questions={questions} />;
}
