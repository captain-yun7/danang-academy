"use server";

import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { presignGet } from "@/lib/r2/presign";
import { synthesizeKorean, isTtsConfigured } from "@/lib/ai/tts";
import { generateStepItems, type GeneratedSteps } from "@/lib/ai/generate-steps";
import { STEP_NO_BY_TYPE, type StepItem, type StepType } from "@/lib/assignments/steps";

type Admin = { userId: string; role: string; organizationId: string };

async function requireAdmin(): Promise<Admin> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; role?: string; organizationId?: string }
    | undefined;
  if (
    !u?.id ||
    !u.role ||
    !u.organizationId ||
    !["super_admin", "owner", "manager", "teacher"].includes(u.role)
  ) {
    throw new Error("forbidden");
  }
  return { userId: u.id, role: u.role, organizationId: u.organizationId };
}

// 단계별 항목: passage는 1개(<=600자), 나머지는 1~15개(각 <=200자)
const stepInputSchema = z
  .object({
    stepType: z.enum(["word", "phrase", "sentence", "passage"]),
    items: z.array(z.string().trim().min(1).max(600)).min(1).max(15),
  })
  .refine((s) =>
    s.stepType === "passage"
      ? s.items.length === 1
      : s.items.every((it) => it.length <= 200)
  );

const createSchema = z
  .object({
    type: z.enum(["pronunciation", "writing", "listening"]),
    targetType: z.enum(["all", "class", "students"]).default("all"),
    classId: z.string().uuid().optional().or(z.literal("")),
    studentIds: z.array(z.string().uuid()).default([]),
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().max(2000).optional().or(z.literal("")),
    targetText: z.string().trim().min(1).max(2000),
    dueDate: z.string().optional().or(z.literal("")),
    steps: z.array(stepInputSchema).min(1).max(4).optional(),
  })
  .refine((d) => d.targetType !== "class" || !!d.classId, { path: ["classId"] })
  .refine((d) => d.targetType !== "students" || d.studentIds.length > 0, {
    path: ["studentIds"],
  })
  .refine((d) => !d.steps || d.type === "pronunciation", { path: ["steps"] })
  .refine(
    (d) => !d.steps || new Set(d.steps.map((s) => s.stepType)).size === d.steps.length,
    { path: ["steps"] }
  );

export async function createAssignment(input: z.infer<typeof createSchema>) {
  const { userId, organizationId } = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const hasSteps = d.type === "pronunciation" && !!d.steps?.length;
  // 단계형은 항목별 TTS만 생성 — 과제 단위 tts_status는 사용하지 않음
  const ttsStatus = hasSteps
    ? null
    : d.type === "pronunciation" || d.type === "listening"
      ? "pending"
      : null;
  const classId = d.targetType === "class" ? d.classId || null : null;

  const inserted = (await sql`
    insert into assignments
      (organization_id, class_id, type, target_type, title, instructions, target_text, tts_status, due_date, created_by)
    values
      (${organizationId},
       ${classId}::uuid,
       ${d.type}::assignment_type,
       ${d.targetType},
       ${d.title},
       ${d.instructions || null},
       ${d.targetText},
       ${ttsStatus},
       ${d.dueDate ? d.dueDate : null}::date,
       ${userId})
    returning id::text
  `) as { id: string }[];
  const id = inserted[0].id;

  if (d.targetType === "students") {
    await setAssignmentTargets(id, organizationId, d.studentIds);
  }

  if (hasSteps) {
    await saveSteps(id, d.steps!);
    after(() => generateStepTts(id, organizationId));
  } else if (d.type === "pronunciation" || d.type === "listening") {
    after(() => generateAndStoreTts(id, d.targetText, organizationId));
  }

  revalidatePath("/admin/assignments");
  redirect(`/admin/assignments/${id}`);
}

// 단계 교체 저장. 같은 위치·같은 텍스트의 기존 TTS는 재사용 (비용 절감)
async function saveSteps(
  assignmentId: string,
  steps: { stepType: StepType; items: string[] }[]
) {
  const prevRows = (await sql`
    select step_no, items from assignment_steps where assignment_id = ${assignmentId}
  `) as { step_no: number; items: StepItem[] }[];
  const prevByNo = new Map(prevRows.map((r) => [r.step_no, r.items]));

  await sql`delete from assignment_steps where assignment_id = ${assignmentId}`;

  for (const s of steps) {
    const stepNo = STEP_NO_BY_TYPE[s.stepType];
    const prev = prevByNo.get(stepNo) ?? [];
    const items: StepItem[] = s.items.map((text, idx) => {
      const p = prev[idx];
      if (p && p.text === text && p.ttsStatus === "ready" && p.ttsKey) return p;
      return { text, ttsKey: null, ttsStatus: "pending" };
    });
    await sql`
      insert into assignment_steps (assignment_id, step_no, step_type, items)
      values (${assignmentId}, ${stepNo}, ${s.stepType}, ${JSON.stringify(items)}::jsonb)
    `;
  }
}

// 단계 항목별 모범음성 생성 — pending/failed 항목만, 항목마다 진행 상태 저장
async function generateStepTts(assignmentId: string, organizationId: string) {
  const owned = (await sql`
    select 1 from assignments where id = ${assignmentId} and organization_id = ${organizationId} limit 1
  `) as unknown[];
  if (!owned[0]) return;

  const stepRows = (await sql`
    select id::text, step_no, items from assignment_steps
    where assignment_id = ${assignmentId}
    order by step_no
  `) as { id: string; step_no: number; items: StepItem[] }[];

  for (const row of stepRows) {
    const items = [...row.items];
    for (let idx = 0; idx < items.length; idx++) {
      if (items[idx].ttsStatus === "ready" && items[idx].ttsKey) continue;
      try {
        if (!isTtsConfigured()) throw new Error("tts_not_configured");
        const audio = await synthesizeKorean(items[idx].text, 0.75);
        const key = `assignment-tts/${assignmentId}/step${row.step_no}-${idx}.mp3`;
        if (!process.env.MOCK_R2_UPLOAD && process.env.R2_BUCKET) {
          await getR2().send(
            new PutObjectCommand({
              Bucket: r2Bucket(),
              Key: key,
              Body: new Uint8Array(audio),
              ContentType: "audio/mpeg",
            })
          );
        }
        items[idx] = { ...items[idx], ttsKey: key, ttsStatus: "ready" };
      } catch (e) {
        console.error("Step TTS generation failed:", e);
        items[idx] = { ...items[idx], ttsStatus: "failed" };
      }
      await sql`
        update assignment_steps set items = ${JSON.stringify(items)}::jsonb
        where id = ${row.id}
      `.catch(() => {});
    }
  }
}

// 개별 배정 학생 목록을 교체 (org 스코프로 유효 학생만)
async function setAssignmentTargets(
  assignmentId: string,
  organizationId: string,
  studentIds: string[]
) {
  await sql`delete from assignment_targets where assignment_id = ${assignmentId}`;
  if (studentIds.length === 0) return;
  // 본 org 학생만 필터링해서 삽입
  const valid = (await sql`
    select id::text from students
    where organization_id = ${organizationId} and id = any(${studentIds}::uuid[])
  `) as { id: string }[];
  for (const s of valid) {
    await sql`
      insert into assignment_targets (assignment_id, student_id, organization_id)
      values (${assignmentId}, ${s.id}::uuid, ${organizationId})
      on conflict do nothing
    `;
  }
}

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export async function updateAssignment(input: z.infer<typeof updateSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 발음/미리듣기형에서 목표 문장이 바뀌면 모범음성 재생성 필요 여부 확인
  const prev = (await sql`
    select a.target_text, a.type::text as type, a.tts_audio_key,
           exists(select 1 from assignment_steps st where st.assignment_id = a.id) as had_steps
    from assignments a
    where a.id = ${d.id} and a.organization_id = ${organizationId} limit 1
  `) as {
    target_text: string | null;
    type: string;
    tts_audio_key: string | null;
    had_steps: boolean;
  }[];
  if (!prev[0]) throw new Error("not_found");
  const textChanged = prev[0].target_text !== d.targetText;
  const hasSteps = d.type === "pronunciation" && !!d.steps?.length;
  const needsSingleTts =
    (d.type === "pronunciation" && !hasSteps) || d.type === "listening";
  // 단계형→단일형 전환 시 음성이 없을 수 있으므로 audio_key 부재도 재생성 조건
  const regenSingle = needsSingleTts && (textChanged || !prev[0].tts_audio_key);

  const classId = d.targetType === "class" ? d.classId || null : null;

  await sql`
    update assignments set
      class_id = ${classId}::uuid,
      target_type = ${d.targetType},
      title = ${d.title},
      instructions = ${d.instructions || null},
      target_text = ${d.targetText},
      due_date = ${d.dueDate ? d.dueDate : null}::date
      ${hasSteps ? sql`, tts_status = null, tts_audio_key = null` : regenSingle ? sql`, tts_status = 'pending'` : sql``}
    where id = ${d.id} and organization_id = ${organizationId}
  `;

  // 개별 배정이면 대상 교체, 아니면 기존 대상 제거
  if (d.targetType === "students") {
    await setAssignmentTargets(d.id, organizationId, d.studentIds);
  } else {
    await sql`delete from assignment_targets where assignment_id = ${d.id}`;
  }

  if (hasSteps) {
    await saveSteps(d.id, d.steps!);
    after(() => generateStepTts(d.id, organizationId));
  } else {
    if (prev[0].had_steps) {
      await sql`delete from assignment_steps where assignment_id = ${d.id}`;
    }
    if (regenSingle) {
      after(() => generateAndStoreTts(d.id, d.targetText, organizationId));
    }
  }

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${d.id}`);
}

export async function deleteAssignment(id: string) {
  const { organizationId } = await requireAdmin();
  await sql`delete from assignments where id = ${id} and organization_id = ${organizationId}`;
  revalidatePath("/admin/assignments");
  redirect("/admin/assignments");
}

export async function regenerateTts(id: string) {
  const { organizationId } = await requireAdmin();
  const rows = (await sql`
    select target_text from assignments
    where id = ${id} and organization_id = ${organizationId}
      and type in ('pronunciation', 'listening') limit 1
  `) as { target_text: string | null }[];
  if (!rows[0]?.target_text) throw new Error("not_found");
  await sql`update assignments set tts_status='pending' where id = ${id} and organization_id = ${organizationId}`;
  after(() => generateAndStoreTts(id, rows[0].target_text as string, organizationId));
  revalidatePath(`/admin/assignments/${id}`);
}

// 모범음성 생성 → R2 업로드 → tts_status 갱신. 과제당 1회 배치.
async function generateAndStoreTts(
  assignmentId: string,
  text: string,
  organizationId: string
) {
  try {
    if (!isTtsConfigured()) throw new Error("tts_not_configured");
    const audio = await synthesizeKorean(text, 0.75);
    const key = `assignment-tts/${assignmentId}.mp3`;
    if (!process.env.MOCK_R2_UPLOAD && process.env.R2_BUCKET) {
      await getR2().send(
        new PutObjectCommand({
          Bucket: r2Bucket(),
          Key: key,
          Body: new Uint8Array(audio),
          ContentType: "audio/mpeg",
        })
      );
    }
    await sql`
      update assignments set tts_audio_key = ${key}, tts_status = 'ready'
      where id = ${assignmentId} and organization_id = ${organizationId}
    `;
  } catch (e) {
    console.error("TTS generation failed:", e);
    await sql`
      update assignments set tts_status = 'failed'
      where id = ${assignmentId} and organization_id = ${organizationId}
    `.catch(() => {});
  }
}

const gradeSchema = z.object({
  submissionId: z.string().uuid(),
  score: z.coerce.number().int().min(0).max(100),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function gradeWriting(input: z.infer<typeof gradeSchema>) {
  const { userId, organizationId } = await requireAdmin();
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const updated = (await sql`
    update assignment_submissions set
      teacher_score = ${d.score},
      teacher_comment = ${d.comment || null},
      graded_by = ${userId},
      graded_at = now(),
      status = 'graded',
      updated_at = now()
    where id = ${d.submissionId} and organization_id = ${organizationId}
    returning assignment_id::text
  `) as { assignment_id: string }[];
  if (!updated[0]) throw new Error("not_found");
  revalidatePath(`/admin/assignments/${updated[0].assignment_id}`);
}

// 제출 녹음 재생용 presigned URL (교사 조회)
export async function getSubmissionAudioUrl(submissionId: string): Promise<string | null> {
  const { organizationId } = await requireAdmin();
  const rows = (await sql`
    select audio_key from assignment_submissions
    where id = ${submissionId} and organization_id = ${organizationId} limit 1
  `) as { audio_key: string | null }[];
  if (!rows[0]?.audio_key) return null;
  return presignGet(rows[0].audio_key);
}

// 단계별 제출 녹음 재생용 presigned URL (교사 조회)
export async function getStepSubmissionAudioUrl(
  stepSubmissionId: string
): Promise<string | null> {
  const { organizationId } = await requireAdmin();
  const rows = (await sql`
    select audio_key from assignment_step_submissions
    where id = ${stepSubmissionId} and organization_id = ${organizationId} limit 1
  `) as { audio_key: string | null }[];
  if (!rows[0]?.audio_key) return null;
  return presignGet(rows[0].audio_key);
}

const sourceTextSchema = z.string().trim().min(10).max(4000);

// 수업 내용 → AI 4단계 자료 생성 (폼에서 미리보기용, 저장 전)
export async function generateAssignmentSteps(sourceText: string): Promise<GeneratedSteps> {
  await requireAdmin();
  const parsed = sourceTextSchema.safeParse(sourceText);
  if (!parsed.success) throw new Error("invalid_input");
  return generateStepItems(parsed.data);
}

// 단계 항목 중 실패한 TTS만 재생성
export async function regenerateStepTts(assignmentId: string) {
  const { organizationId } = await requireAdmin();
  const owned = (await sql`
    select 1 from assignments
    where id = ${assignmentId} and organization_id = ${organizationId} limit 1
  `) as unknown[];
  if (!owned[0]) throw new Error("not_found");

  const rows = (await sql`
    select id::text, items from assignment_steps where assignment_id = ${assignmentId}
  `) as { id: string; items: StepItem[] }[];
  for (const r of rows) {
    if (!r.items.some((it) => it.ttsStatus === "failed")) continue;
    const items = r.items.map((it) =>
      it.ttsStatus === "failed" ? { ...it, ttsStatus: "pending" as const } : it
    );
    await sql`update assignment_steps set items = ${JSON.stringify(items)}::jsonb where id = ${r.id}`;
  }

  after(() => generateStepTts(assignmentId, organizationId));
  revalidatePath(`/admin/assignments/${assignmentId}`);
}
