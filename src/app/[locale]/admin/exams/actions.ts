"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { SECTIONS, type Section } from "@/lib/exams/scoring";

async function requireAdmin() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; organizationId?: string } | undefined;
  if (!u?.role || !u.organizationId || !["super_admin", "owner", "manager"].includes(u.role)) {
    throw new Error("forbidden");
  }
  return { userId: u.id ?? null, organizationId: u.organizationId };
}

async function assertExamOrg(examId: string, organizationId: string) {
  const rows = (await sql`
    select id::text, class_id::text as class_id, status from exams
    where id = ${examId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string; class_id: string; status: string }[];
  if (!rows[0]) throw new Error("not_found");
  return rows[0];
}

const SECTION_KEYS = SECTIONS.map((s) => s.key) as [Section, ...Section[]];

// ---- 시험 ----
const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createExam(input: z.infer<typeof createSchema>) {
  const { organizationId, userId } = await requireAdmin();
  const d = createSchema.parse(input);
  const cls = (await sql`
    select id::text from classes where id = ${d.classId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string }[];
  if (!cls[0]) throw new Error("invalid_class");

  const inserted = (await sql`
    insert into exams (organization_id, class_id, title, exam_date, created_by)
    values (${organizationId}, ${d.classId}::uuid, ${d.title}, ${d.date}::date, ${userId}::uuid)
    returning id::text
  `) as { id: string }[];
  revalidatePath("/admin/exams");
  redirect(`/admin/exams/${inserted[0].id}`);
}

const weightsSchema = z.object({
  examId: z.string().uuid(),
  w_listening: z.coerce.number().int().min(0).max(100),
  w_reading: z.coerce.number().int().min(0).max(100),
  w_grammar: z.coerce.number().int().min(0).max(100),
  w_writing: z.coerce.number().int().min(0).max(100),
  w_speaking: z.coerce.number().int().min(0).max(100),
});

export async function updateWeights(input: z.infer<typeof weightsSchema>) {
  const { organizationId } = await requireAdmin();
  const d = weightsSchema.parse(input);
  await assertExamOrg(d.examId, organizationId);
  await sql`
    update exams set
      w_listening = ${d.w_listening}, w_reading = ${d.w_reading}, w_grammar = ${d.w_grammar},
      w_writing = ${d.w_writing}, w_speaking = ${d.w_speaking}
    where id = ${d.examId}::uuid and organization_id = ${organizationId}
  `;
  revalidatePath(`/admin/exams/${d.examId}`);
  return { ok: true };
}

const passageSchema = z.object({
  examId: z.string().uuid(),
  ko: z.string().trim().max(4000),
  vi: z.string().trim().max(4000),
});

export async function updatePassage(input: z.infer<typeof passageSchema>) {
  const { organizationId } = await requireAdmin();
  const d = passageSchema.parse(input);
  await assertExamOrg(d.examId, organizationId);
  await sql`
    update exams set reading_passage_ko = ${d.ko || null}, reading_passage_vi = ${d.vi || null}
    where id = ${d.examId}::uuid and organization_id = ${organizationId}
  `;
  revalidatePath(`/admin/exams/${d.examId}`);
  return { ok: true };
}

export async function deleteExam(examId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(examId);
  await assertExamOrg(examId, organizationId);
  await sql`delete from exams where id = ${examId}::uuid and organization_id = ${organizationId}`;
  revalidatePath("/admin/exams");
  redirect("/admin/exams");
}

export async function setPublished(examId: string, published: boolean) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(examId);
  await assertExamOrg(examId, organizationId);
  if (published) {
    // 게시 전 검증: 각 섹션에 문항 1개 이상
    const counts = (await sql`
      select section, count(*)::int as cnt from exam_questions
      where exam_id = ${examId}::uuid group by section
    `) as { section: string; cnt: number }[];
    const have = new Set(counts.map((c) => c.section));
    const missing = SECTIONS.filter((s) => !have.has(s.key)).map((s) => s.label);
    if (missing.length) return { ok: false as const, error: `문항 없는 섹션: ${missing.join(", ")}` };
  }
  await sql`update exams set status = ${published ? "published" : "draft"}
            where id = ${examId}::uuid and organization_id = ${organizationId}`;
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { ok: true as const };
}

// ---- 문항 ----
const choiceSchema = z.object({ ko: z.string().trim().max(300), vi: z.string().trim().max(300) });
const questionSchema = z.object({
  examId: z.string().uuid(),
  section: z.enum(SECTION_KEYS),
  promptKo: z.string().trim().max(1000),
  promptVi: z.string().trim().max(1000),
  choices: z.array(choiceSchema).max(4).optional(),
  answerIndex: z.coerce.number().int().min(0).max(3).nullable().optional(),
  points: z.coerce.number().int().min(0).max(100),
  audioKey: z.string().trim().max(300).optional(),
});

function isMcq(section: Section) {
  return SECTIONS.find((s) => s.key === section)?.mcq ?? false;
}

export async function addQuestion(input: z.infer<typeof questionSchema>) {
  const { organizationId } = await requireAdmin();
  const d = questionSchema.parse(input);
  await assertExamOrg(d.examId, organizationId);

  const mcq = isMcq(d.section);
  const choices = mcq ? d.choices ?? [] : null;
  if (mcq && (!choices || choices.length < 2)) throw new Error("need_choices");
  const answer = mcq ? d.answerIndex ?? 0 : null;
  if (mcq && choices && (answer === null || answer >= choices.length)) throw new Error("bad_answer");

  const ord = (await sql`
    select coalesce(max(order_no), 0) + 1 as next from exam_questions
    where exam_id = ${d.examId}::uuid and section = ${d.section}
  `) as { next: number }[];

  await sql`
    insert into exam_questions
      (exam_id, section, order_no, prompt_ko, prompt_vi, choices, answer_index, points, audio_key)
    values
      (${d.examId}::uuid, ${d.section}, ${ord[0].next}, ${d.promptKo || null}, ${d.promptVi || null},
       ${choices ? JSON.stringify(choices) : null}::jsonb, ${answer}, ${d.points}, ${d.audioKey || null})
  `;
  revalidatePath(`/admin/exams/${d.examId}`);
  return { ok: true };
}

const updateQSchema = questionSchema.extend({ questionId: z.string().uuid() });
export async function updateQuestion(input: z.infer<typeof updateQSchema>) {
  const { organizationId } = await requireAdmin();
  const d = updateQSchema.parse(input);
  await assertExamOrg(d.examId, organizationId);
  const mcq = isMcq(d.section);
  const choices = mcq ? d.choices ?? [] : null;
  if (mcq && (!choices || choices.length < 2)) throw new Error("need_choices");
  const answer = mcq ? d.answerIndex ?? 0 : null;

  await sql`
    update exam_questions set
      prompt_ko = ${d.promptKo || null}, prompt_vi = ${d.promptVi || null},
      choices = ${choices ? JSON.stringify(choices) : null}::jsonb,
      answer_index = ${answer}, points = ${d.points}, audio_key = ${d.audioKey || null}
    where id = ${d.questionId}::uuid and exam_id = ${d.examId}::uuid
  `;
  revalidatePath(`/admin/exams/${d.examId}`);
  return { ok: true };
}

export async function deleteQuestion(examId: string, questionId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(examId);
  z.string().uuid().parse(questionId);
  await assertExamOrg(examId, organizationId);
  await sql`delete from exam_questions where id = ${questionId}::uuid and exam_id = ${examId}::uuid`;
  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}
