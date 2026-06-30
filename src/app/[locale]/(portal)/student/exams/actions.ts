"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SECTIONS, type Section } from "@/lib/exams/scoring";
import { gradeWritingText, recomputeAttempt } from "@/lib/exams/grade";

const SECTION_KEYS = SECTIONS.map((s) => s.key) as [Section, ...Section[]];

// 본인 반의 게시된 시험인지 확인
async function examForStudent(examId: string, studentId: string, organizationId: string) {
  const rows = (await sql`
    select e.id::text, e.class_id::text as class_id, e.status
    from exams e
    join students s on s.id = ${studentId}::uuid
    where e.id = ${examId}::uuid and e.organization_id = ${organizationId}
      and e.status = 'published' and e.class_id = s.class_id
    limit 1
  `) as { id: string; class_id: string; status: string }[];
  return rows[0] ?? null;
}

async function getOrCreateAttempt(examId: string, studentId: string, organizationId: string) {
  await sql`
    insert into exam_attempts (exam_id, student_id, organization_id, status)
    values (${examId}::uuid, ${studentId}::uuid, ${organizationId}, 'in_progress')
    on conflict (exam_id, student_id) do nothing
  `;
  const rows = (await sql`
    select id::text, status from exam_attempts
    where exam_id = ${examId}::uuid and student_id = ${studentId}::uuid limit 1
  `) as { id: string; status: string }[];
  return rows[0];
}

export async function startExam(examId: string) {
  const student = await requireStudent();
  z.string().uuid().parse(examId);
  const exam = await examForStudent(examId, student.studentId, student.organizationId);
  if (!exam) throw new Error("not_available");
  await getOrCreateAttempt(examId, student.studentId, student.organizationId);
  revalidatePath(`/student/exams/${examId}`);
  return { ok: true };
}

const saveSchema = z.object({
  examId: z.string().uuid(),
  section: z.enum(SECTION_KEYS),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      choiceIndex: z.coerce.number().int().min(0).max(3).nullable().optional(),
      text: z.string().trim().max(4000).optional(),
    })
  ),
});

export async function saveSection(input: z.infer<typeof saveSchema>) {
  const student = await requireStudent();
  const d = saveSchema.parse(input);
  const exam = await examForStudent(d.examId, student.studentId, student.organizationId);
  if (!exam) throw new Error("not_available");
  const attempt = await getOrCreateAttempt(d.examId, student.studentId, student.organizationId);
  if (attempt.status === "completed") throw new Error("already_done");

  // 이 섹션 문항 정보 (정답·배점)
  const qs = (await sql`
    select id::text, section, answer_index, points from exam_questions
    where exam_id = ${d.examId}::uuid and section = ${d.section}
  `) as { id: string; section: string; answer_index: number | null; points: number }[];
  const qMap = new Map(qs.map((q) => [q.id, q]));
  const isMcq = SECTIONS.find((s) => s.key === d.section)?.mcq ?? false;

  for (const a of d.answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    if (isMcq) {
      const choice = a.choiceIndex ?? null;
      const awarded = choice !== null && choice === q.answer_index ? q.points : 0;
      await sql`
        insert into exam_answers (attempt_id, question_id, organization_id, choice_index, awarded_points, status)
        values (${attempt.id}::uuid, ${a.questionId}::uuid, ${student.organizationId}, ${choice}, ${awarded}, 'graded')
        on conflict (attempt_id, question_id) do update set
          choice_index = excluded.choice_index, awarded_points = excluded.awarded_points,
          status = 'graded', updated_at = now()
      `;
    } else if (d.section === "writing") {
      const text = a.text ?? "";
      const { score, feedback } = await gradeWritingText({
        prompt: (await promptOf(a.questionId)) ?? "",
        text,
        maxPoints: q.points,
      });
      await sql`
        insert into exam_answers (attempt_id, question_id, organization_id, answer_text, ai_score, ai_feedback, awarded_points, status)
        values (${attempt.id}::uuid, ${a.questionId}::uuid, ${student.organizationId}, ${text}, ${score}, ${feedback}, ${score}, 'graded')
        on conflict (attempt_id, question_id) do update set
          answer_text = excluded.answer_text, ai_score = excluded.ai_score, ai_feedback = excluded.ai_feedback,
          awarded_points = excluded.awarded_points, status = 'graded', updated_at = now()
      `;
    }
  }
  await recomputeAttempt(attempt.id);
  revalidatePath(`/student/exams/${d.examId}/${d.section}`);
  return { ok: true };
}

async function promptOf(questionId: string): Promise<string | null> {
  const rows = (await sql`select prompt_ko from exam_questions where id = ${questionId}::uuid limit 1`) as {
    prompt_ko: string | null;
  }[];
  return rows[0]?.prompt_ko ?? null;
}

export async function submitExam(examId: string) {
  const student = await requireStudent();
  z.string().uuid().parse(examId);
  const exam = await examForStudent(examId, student.studentId, student.organizationId);
  if (!exam) throw new Error("not_available");
  const attempt = await getOrCreateAttempt(examId, student.studentId, student.organizationId);
  await sql`
    update exam_attempts set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = ${attempt.id}::uuid and status <> 'completed'
  `;
  await recomputeAttempt(attempt.id);
  revalidatePath(`/student/exams/${examId}`);
  return { ok: true };
}
