"use server";

import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { synthesizeKorean, isTtsConfigured } from "@/lib/ai/tts";
import { recomputeResult } from "@/lib/exams/grade";
import { generateWeeklyComment } from "@/lib/exams/comment";
import { SKILLS, TYPES_FOR_SKILL, type QuestionType, type Skill } from "@/lib/exams/scoring";

async function requireAdmin() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; organizationId?: string } | undefined;
  if (!u?.role || !u.organizationId || !["super_admin", "owner", "manager"].includes(u.role)) {
    throw new Error("forbidden");
  }
  return { userId: u.id ?? null, organizationId: u.organizationId };
}

async function assertTestOrg(testId: string, organizationId: string) {
  const rows = (await sql`
    select id::text, class_id::text as class_id, status from weekly_tests
    where id = ${testId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string; class_id: string; status: string }[];
  if (!rows[0]) throw new Error("not_found");
  return rows[0];
}

const SKILL_KEYS = SKILLS.map((s) => s.key) as [Skill, ...Skill[]];
const TYPE_KEYS = TYPES_FOR_SKILL.listening.concat(
  TYPES_FOR_SKILL.reading, TYPES_FOR_SKILL.writing, TYPES_FOR_SKILL.speaking
) as QuestionType[];

// ---- 시험 ----
const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  lessonRange: z.string().trim().max(40).optional(),
});
export async function createTest(input: z.infer<typeof createSchema>) {
  const { organizationId, userId } = await requireAdmin();
  const d = createSchema.parse(input);
  const cls = (await sql`
    select id::text from classes where id = ${d.classId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string }[];
  if (!cls[0]) throw new Error("invalid_class");
  const ins = (await sql`
    insert into weekly_tests (organization_id, class_id, title, lesson_range, created_by)
    values (${organizationId}, ${d.classId}::uuid, ${d.title}, ${d.lessonRange || null}, ${userId}::uuid)
    returning id::text
  `) as { id: string }[];
  revalidatePath("/admin/exams");
  redirect(`/admin/exams/${ins[0].id}`);
}

export async function deleteTest(testId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(testId);
  await assertTestOrg(testId, organizationId);
  await sql`delete from weekly_tests where id = ${testId}::uuid and organization_id = ${organizationId}`;
  revalidatePath("/admin/exams");
  redirect("/admin/exams");
}

export async function setPublished(testId: string, published: boolean) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(testId);
  await assertTestOrg(testId, organizationId);
  if (published) {
    const rows = (await sql`
      select distinct skill from weekly_questions where test_id = ${testId}::uuid
    `) as { skill: string }[];
    const have = new Set(rows.map((r) => r.skill));
    const missing = SKILLS.filter((s) => !have.has(s.key)).map((s) => s.label);
    if (missing.length) return { ok: false as const, error: `문항 없는 영역: ${missing.join(", ")}` };
  }
  await sql`update weekly_tests set status = ${published ? "published" : "draft"}
            where id = ${testId}::uuid and organization_id = ${organizationId}`;
  revalidatePath(`/admin/exams/${testId}`);
  revalidatePath("/admin/exams");
  return { ok: true as const };
}

// ---- 섹션 ----
const sectionSchema = z.object({
  testId: z.string().uuid(),
  skill: z.enum(SKILL_KEYS),
  title: z.string().trim().min(1).max(120),
  maxScore: z.coerce.number().int().min(0).max(100),
});
export async function addSection(input: z.infer<typeof sectionSchema>) {
  const { organizationId } = await requireAdmin();
  const d = sectionSchema.parse(input);
  await assertTestOrg(d.testId, organizationId);
  const ord = (await sql`
    select coalesce(max(order_index),0)+1 as n from weekly_sections where test_id = ${d.testId}::uuid and skill = ${d.skill}
  `) as { n: number }[];
  await sql`
    insert into weekly_sections (test_id, skill, section_title, max_score, order_index)
    values (${d.testId}::uuid, ${d.skill}, ${d.title}, ${d.maxScore}, ${ord[0].n})
  `;
  revalidatePath(`/admin/exams/${d.testId}`);
  return { ok: true };
}
export async function deleteSection(testId: string, sectionId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(sectionId);
  await assertTestOrg(testId, organizationId);
  await sql`delete from weekly_sections where id = ${sectionId}::uuid and test_id = ${testId}::uuid`;
  revalidatePath(`/admin/exams/${testId}`);
  return { ok: true };
}

// ---- 문항 ----
const choice = z.object({ ko: z.string().trim().max(400), vi: z.string().trim().max(400) });
const questionSchema = z.object({
  testId: z.string().uuid(),
  sectionId: z.string().uuid(),
  skill: z.enum(SKILL_KEYS),
  questionType: z.enum(TYPE_KEYS as [QuestionType, ...QuestionType[]]),
  questionText: z.string().trim().max(2000),
  passageText: z.string().trim().max(4000).optional(),
  listeningScript: z.string().trim().max(2000).optional(),
  options: z.array(choice).max(6).optional(),
  correctAnswer: z.any().optional(),   // index | "O"/"X" | number[] | string | string[]
  points: z.coerce.number().int().min(0).max(100),
  maxPlayCount: z.coerce.number().int().min(1).max(9).optional(),
});
export async function addQuestion(input: z.infer<typeof questionSchema>) {
  const { organizationId } = await requireAdmin();
  const d = questionSchema.parse(input);
  await assertTestOrg(d.testId, organizationId);
  const ord = (await sql`
    select coalesce(max(order_index),0)+1 as n from weekly_questions where section_id = ${d.sectionId}::uuid
  `) as { n: number }[];
  const needsTts = d.skill === "listening" && !!d.listeningScript;
  const rows = (await sql`
    insert into weekly_questions
      (test_id, section_id, skill, question_type, question_text, passage_text, listening_script,
       tts_status, options, correct_answer, points, max_play_count, order_index)
    values
      (${d.testId}::uuid, ${d.sectionId}::uuid, ${d.skill}, ${d.questionType},
       ${d.questionText || null}, ${d.passageText || null}, ${d.listeningScript || null},
       ${needsTts ? "pending" : null},
       ${d.options ? JSON.stringify(d.options) : null}::jsonb,
       ${d.correctAnswer !== undefined ? JSON.stringify(d.correctAnswer) : null}::jsonb,
       ${d.points}, ${d.maxPlayCount ?? 2}, ${ord[0].n})
    returning id::text
  `) as { id: string }[];
  if (needsTts) after(() => generateTtsFor(d.testId, organizationId));
  revalidatePath(`/admin/exams/${d.testId}`);
  return { ok: true, id: rows[0].id };
}

const updateQSchema = questionSchema.extend({ questionId: z.string().uuid() });
export async function updateQuestion(input: z.infer<typeof updateQSchema>) {
  const { organizationId } = await requireAdmin();
  const d = updateQSchema.parse(input);
  await assertTestOrg(d.testId, organizationId);
  // 듣기 script 변경 시 재생성
  const prev = (await sql`
    select listening_script, tts_status from weekly_questions
    where id = ${d.questionId}::uuid and test_id = ${d.testId}::uuid limit 1
  `) as { listening_script: string | null; tts_status: string | null }[];
  const scriptChanged = d.skill === "listening" && (prev[0]?.listening_script ?? "") !== (d.listeningScript ?? "");
  const nextTts = scriptChanged && d.listeningScript ? "pending" : (prev[0]?.tts_status ?? null);
  await sql`
    update weekly_questions set
      question_text = ${d.questionText || null}, passage_text = ${d.passageText || null},
      listening_script = ${d.listeningScript || null},
      options = ${d.options ? JSON.stringify(d.options) : null}::jsonb,
      correct_answer = ${d.correctAnswer !== undefined ? JSON.stringify(d.correctAnswer) : null}::jsonb,
      points = ${d.points}, max_play_count = ${d.maxPlayCount ?? 2},
      tts_status = ${nextTts}
    where id = ${d.questionId}::uuid and test_id = ${d.testId}::uuid
  `;
  if (scriptChanged && d.listeningScript) after(() => generateTtsFor(d.testId, organizationId));
  revalidatePath(`/admin/exams/${d.testId}`);
  return { ok: true };
}
export async function deleteQuestion(testId: string, questionId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(questionId);
  await assertTestOrg(testId, organizationId);
  await sql`delete from weekly_questions where id = ${questionId}::uuid and test_id = ${testId}::uuid`;
  revalidatePath(`/admin/exams/${testId}`);
  return { ok: true };
}

// ---- 듣기 TTS 일괄 생성 ----
export async function regenerateTts(testId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(testId);
  await assertTestOrg(testId, organizationId);
  await sql`update weekly_questions set tts_status = 'pending'
            where test_id = ${testId}::uuid and skill = 'listening' and listening_script is not null
              and (audio_key is null or tts_status = 'failed')`;
  after(() => generateTtsFor(testId, organizationId));
  revalidatePath(`/admin/exams/${testId}`);
  return { ok: true };
}

async function generateTtsFor(testId: string, organizationId: string) {
  if (!isTtsConfigured()) return;
  const todo = (await sql`
    select id::text, listening_script from weekly_questions
    where test_id = ${testId}::uuid and skill = 'listening' and listening_script is not null
      and (audio_key is null or tts_status in ('pending','failed'))
  `) as { id: string; listening_script: string }[];
  const useMock = process.env.MOCK_R2_UPLOAD === "true" || !process.env.R2_BUCKET;
  const BATCH = 5;
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(
      todo.slice(i, i + BATCH).map(async (q) => {
        try {
          const key = `exam-tts/${testId}/${q.id}.mp3`;
          if (!useMock) {
            const audio = await synthesizeKorean(q.listening_script, 0.9);
            await getR2().send(new PutObjectCommand({ Bucket: r2Bucket(), Key: key, Body: new Uint8Array(audio), ContentType: "audio/mpeg" }));
          }
          await sql`update weekly_questions set audio_key = ${key}, tts_status = 'ready' where id = ${q.id}::uuid`;
        } catch {
          await sql`update weekly_questions set tts_status = 'failed' where id = ${q.id}::uuid`;
        }
      })
    );
  }
  void organizationId;
}

// ---- 교사 채점/보고서 ----
const confirmWritingSchema = z.object({
  testId: z.string().uuid(),
  answerId: z.string().uuid(),
  score: z.coerce.number().int().min(0).max(100),
  comment: z.string().trim().max(1000).optional(),
});
export async function confirmWriting(input: z.infer<typeof confirmWritingSchema>) {
  const { organizationId } = await requireAdmin();
  const d = confirmWritingSchema.parse(input);
  await assertTestOrg(d.testId, organizationId);
  const rows = (await sql`
    update weekly_answers set teacher_score = ${d.score}, teacher_comment = ${d.comment || null},
      final_score = ${d.score}, status = 'graded', updated_at = now()
    where id = ${d.answerId}::uuid and organization_id = ${organizationId}
    returning student_id::text
  `) as { student_id: string }[];
  if (rows[0]) await recomputeResult(d.testId, rows[0].student_id, organizationId);
  revalidatePath(`/admin/exams/${d.testId}/results`);
  return { ok: true };
}

export async function finalizeResult(testId: string, studentId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(testId);
  z.string().uuid().parse(studentId);
  await assertTestOrg(testId, organizationId);
  await recomputeResult(testId, studentId, organizationId);
  await sql`update weekly_results set status = 'finalized', finalized_at = now(), updated_at = now()
            where test_id = ${testId}::uuid and student_id = ${studentId}::uuid and organization_id = ${organizationId}`;
  revalidatePath(`/admin/exams/${testId}/results`);
  return { ok: true };
}

async function getCuts(organizationId: string) {
  const rows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${organizationId} limit 1
  `) as { excellent: number; good: number; normal: number }[];
  return rows[0] ?? { excellent: 90, good: 75, normal: 60 };
}

export async function generateComments(testId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(testId);
  await assertTestOrg(testId, organizationId);
  const cuts = await getCuts(organizationId);
  const rows = (await sql`
    select r.id::text, st.name, r.listening_score, r.reading_score, r.writing_final_score, r.speaking_score,
           r.total_score, r.average_score
    from weekly_results r join students st on st.id = r.student_id
    where r.test_id = ${testId}::uuid and r.organization_id = ${organizationId}
  `) as Array<Record<string, number | string | null>>;
  let count = 0;
  for (const r of rows) {
    const comment = await generateWeeklyComment({
      studentName: r.name as string,
      skillScores: {
        listening: r.listening_score as number | null,
        reading: r.reading_score as number | null,
        writing: r.writing_final_score as number | null,
        speaking: r.speaking_score as number | null,
      },
      total: (r.total_score as number) ?? 0,
      average: Number(r.average_score ?? 0),
      cuts,
    });
    await sql`update weekly_results set teacher_comment = ${comment}, updated_at = now()
              where id = ${(r.id as string)}::uuid and organization_id = ${organizationId}`;
    count++;
  }
  revalidatePath(`/admin/exams/${testId}/results`);
  return { ok: true, count };
}

const commentSchema = z.object({ testId: z.string().uuid(), studentId: z.string().uuid(), comment: z.string().trim().max(2000) });
export async function saveComment(input: z.infer<typeof commentSchema>) {
  const { organizationId } = await requireAdmin();
  const d = commentSchema.parse(input);
  await assertTestOrg(d.testId, organizationId);
  await sql`update weekly_results set teacher_comment = ${d.comment}, updated_at = now()
            where test_id = ${d.testId}::uuid and student_id = ${d.studentId}::uuid and organization_id = ${organizationId}`;
  revalidatePath(`/admin/exams/${d.testId}/results`);
  return { ok: true };
}
