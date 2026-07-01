import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { presignGet } from "@/lib/r2/presign";
import { SKILL_ORDER, type QuestionType, type Skill } from "@/lib/exams/scoring";
import { AreaRunner, type RunnerSection, type RunnerQuestion } from "./section-runner";

async function safePresign(key: string | null): Promise<string | null> {
  if (!key) return null;
  try { return await presignGet(key); } catch { return null; }
}

export default async function AreaPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!SKILL_ORDER.includes(section as Skill)) notFound();
  const skill = section as Skill;
  const student = await requireStudent();

  const tRows = (await sql`
    select t.id::text, t.title
    from weekly_tests t join students s on s.id = ${student.studentId}::uuid
    where t.id = ${id}::uuid and t.organization_id = ${student.organizationId}
      and t.status = 'published' and t.class_id = s.class_id limit 1
  `) as { id: string; title: string }[];
  if (!tRows[0]) notFound();

  const secRows = (await sql`
    select id::text, section_title, order_index from weekly_sections
    where test_id = ${id}::uuid and skill = ${skill} order by order_index
  `) as { id: string; section_title: string; order_index: number }[];

  const qRows = (await sql`
    select q.id::text, q.section_id::text, q.question_type, q.question_text, q.passage_text,
           q.audio_key, q.tts_status, q.options, q.points, q.max_play_count, q.order_index,
           a.selected_option, a.answer_text, a.status as ans_status
    from weekly_questions q
    left join weekly_results r on r.test_id = q.test_id and r.student_id = ${student.studentId}::uuid
    left join weekly_answers a on a.test_id = q.test_id and a.question_id = q.id and a.student_id = ${student.studentId}::uuid
    where q.test_id = ${id}::uuid and q.skill = ${skill}
    order by q.order_index
  `) as Array<{
    id: string; section_id: string; question_type: string; question_text: string | null; passage_text: string | null;
    audio_key: string | null; tts_status: string | null; options: unknown; points: number; max_play_count: number;
    selected_option: unknown; answer_text: string | null; ans_status: string | null;
  }>;

  const questions: RunnerQuestion[] = await Promise.all(qRows.map(async (q) => ({
    id: q.id, sectionId: q.section_id, questionType: q.question_type as QuestionType,
    questionText: q.question_text ?? "", passageText: q.passage_text ?? "",
    audioUrl: q.tts_status === "ready" ? await safePresign(q.audio_key) : null,
    options: (q.options as { ko: string; vi: string }[] | null) ?? [],
    points: q.points, maxPlayCount: q.max_play_count,
    savedOption: q.selected_option ?? null, savedText: q.answer_text ?? "", answered: !!q.ans_status,
  })));

  const sections: RunnerSection[] = secRows.map((s) => ({ id: s.id, title: s.section_title }));
  const idx = SKILL_ORDER.indexOf(skill);
  const nextSkill = idx < SKILL_ORDER.length - 1 ? SKILL_ORDER[idx + 1] : null;

  return (
    <AreaRunner testId={id} testTitle={tRows[0].title} skill={skill} stepIndex={idx} stepTotal={SKILL_ORDER.length}
      nextSkill={nextSkill} sections={sections} questions={questions} />
  );
}
