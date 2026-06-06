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

const createSchema = z.object({
  type: z.enum(["pronunciation", "writing"]),
  classId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(2000).optional().or(z.literal("")),
  targetText: z.string().trim().min(1).max(2000),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function createAssignment(input: z.infer<typeof createSchema>) {
  const { userId, organizationId } = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const ttsStatus = d.type === "pronunciation" ? "pending" : null;

  const inserted = (await sql`
    insert into assignments
      (organization_id, class_id, type, title, instructions, target_text, tts_status, due_date, created_by)
    values
      (${organizationId},
       ${d.classId ? d.classId : null}::uuid,
       ${d.type}::assignment_type,
       ${d.title},
       ${d.instructions || null},
       ${d.targetText},
       ${ttsStatus},
       ${d.dueDate ? d.dueDate : null}::date,
       ${userId})
    returning id::text
  `) as { id: string }[];
  const id = inserted[0].id;

  if (d.type === "pronunciation") {
    after(() => generateAndStoreTts(id, d.targetText, organizationId));
  }

  revalidatePath("/admin/assignments");
  redirect(`/admin/assignments/${id}`);
}

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export async function updateAssignment(input: z.infer<typeof updateSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 발음형에서 목표 문장이 바뀌면 모범음성 재생성 필요 여부 확인
  const prev = (await sql`
    select target_text, type::text as type from assignments
    where id = ${d.id} and organization_id = ${organizationId} limit 1
  `) as { target_text: string | null; type: string }[];
  if (!prev[0]) throw new Error("not_found");
  const textChanged = prev[0].target_text !== d.targetText;
  const isPronunciation = d.type === "pronunciation";

  await sql`
    update assignments set
      class_id = ${d.classId ? d.classId : null}::uuid,
      title = ${d.title},
      instructions = ${d.instructions || null},
      target_text = ${d.targetText},
      due_date = ${d.dueDate ? d.dueDate : null}::date
      ${isPronunciation && textChanged ? sql`, tts_status = 'pending'` : sql``}
    where id = ${d.id} and organization_id = ${organizationId}
  `;

  if (isPronunciation && textChanged) {
    after(() => generateAndStoreTts(d.id, d.targetText, organizationId));
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
    where id = ${id} and organization_id = ${organizationId} and type = 'pronunciation' limit 1
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
