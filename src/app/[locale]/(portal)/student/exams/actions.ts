"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SKILLS, type QuestionType, type Skill } from "@/lib/exams/scoring";
import { gradeObjective, gradeWritingAI, recomputeResult } from "@/lib/exams/grade";

const SKILL_KEYS = SKILLS.map((s) => s.key) as [Skill, ...Skill[]];

async function testForStudent(testId: string, studentId: string, organizationId: string) {
  const rows = (await sql`
    select t.id::text, t.class_id::text as class_id, t.status
    from weekly_tests t join students s on s.id = ${studentId}::uuid
    where t.id = ${testId}::uuid and t.organization_id = ${organizationId}
      and t.status = 'published' and t.class_id = s.class_id limit 1
  `) as { id: string; class_id: string; status: string }[];
  return rows[0] ?? null;
}

async function ensureResult(testId: string, studentId: string, organizationId: string) {
  await sql`
    insert into weekly_results (test_id, student_id, organization_id, status)
    values (${testId}::uuid, ${studentId}::uuid, ${organizationId}, 'doing')
    on conflict (test_id, student_id) do nothing
  `;
}

export async function startTest(testId: string) {
  const student = await requireStudent();
  z.string().uuid().parse(testId);
  const t = await testForStudent(testId, student.studentId, student.organizationId);
  if (!t) throw new Error("not_available");
  await ensureResult(testId, student.studentId, student.organizationId);
  revalidatePath(`/student/exams/${testId}`);
  return { ok: true };
}

const saveSchema = z.object({
  testId: z.string().uuid(),
  skill: z.enum(SKILL_KEYS),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOption: z.any().optional(),   // number | "O"/"X" | number[]
    answerText: z.string().max(4000).optional(),
  })),
});

export async function saveArea(input: z.infer<typeof saveSchema>) {
  const student = await requireStudent();
  const d = saveSchema.parse(input);
  const t = await testForStudent(d.testId, student.studentId, student.organizationId);
  if (!t) throw new Error("not_available");
  await ensureResult(d.testId, student.studentId, student.organizationId);

  const qs = (await sql`
    select id::text, question_type, correct_answer, points, question_text
    from weekly_questions where test_id = ${d.testId}::uuid and skill = ${d.skill}
  `) as { id: string; question_type: QuestionType; correct_answer: unknown; points: number; question_text: string | null }[];
  const qMap = new Map(qs.map((q) => [q.id, q]));

  for (const a of d.answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const type = q.question_type;
    if (type === "translation" || type === "short_writing") {
      const text = a.answerText ?? "";
      const { score, feedback } = await gradeWritingAI({
        questionText: q.question_text ?? "", reference: typeof q.correct_answer === "string" ? q.correct_answer : "",
        text, maxPoints: q.points,
      });
      await sql`
        insert into weekly_answers (test_id, question_id, student_id, organization_id, answer_text, ai_score, ai_feedback, final_score, status)
        values (${d.testId}::uuid, ${a.questionId}::uuid, ${student.studentId}::uuid, ${student.organizationId}, ${text}, ${score}, ${feedback}, ${score}, 'graded')
        on conflict (test_id, question_id, student_id) do update set
          answer_text = excluded.answer_text, ai_score = excluded.ai_score, ai_feedback = excluded.ai_feedback,
          final_score = excluded.final_score, status = 'graded', updated_at = now()`;
    } else {
      // 객관식류 자동채점
      const { isCorrect, awarded } = gradeObjective(
        { question_type: type, correct_answer: q.correct_answer, points: q.points },
        { selected_option: a.selectedOption ?? null, answer_text: a.answerText ?? null }
      );
      const selJson = a.selectedOption !== undefined ? JSON.stringify(a.selectedOption) : null;
      await sql`
        insert into weekly_answers (test_id, question_id, student_id, organization_id, selected_option, answer_text, is_correct, auto_score, final_score, status)
        values (${d.testId}::uuid, ${a.questionId}::uuid, ${student.studentId}::uuid, ${student.organizationId},
                ${selJson}::jsonb, ${a.answerText ?? null}, ${isCorrect}, ${awarded}, ${awarded}, 'graded')
        on conflict (test_id, question_id, student_id) do update set
          selected_option = excluded.selected_option, answer_text = excluded.answer_text,
          is_correct = excluded.is_correct, auto_score = excluded.auto_score, final_score = excluded.final_score,
          status = 'graded', updated_at = now()`;
    }
  }
  await recomputeResult(d.testId, student.studentId, student.organizationId);
  revalidatePath(`/student/exams/${d.testId}/${d.skill}`);
  return { ok: true };
}

export async function submitTest(testId: string) {
  const student = await requireStudent();
  z.string().uuid().parse(testId);
  const t = await testForStudent(testId, student.studentId, student.organizationId);
  if (!t) throw new Error("not_available");
  await ensureResult(testId, student.studentId, student.organizationId);
  // 쓰기 문항 존재 여부 → 있으면 교사 검토 대기
  const w = (await sql`select 1 from weekly_questions where test_id = ${testId}::uuid and skill = 'writing' limit 1`) as unknown[];
  const status = w.length ? "waiting_writing_review" : "submitted";
  await sql`update weekly_results set status = ${status}, submitted_at = now(), updated_at = now()
            where test_id = ${testId}::uuid and student_id = ${student.studentId}::uuid and status <> 'finalized'`;
  await recomputeResult(testId, student.studentId, student.organizationId);
  revalidatePath(`/student/exams/${testId}`);
  return { ok: true };
}
