"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !userId || !["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, userId, organizationId };
}

const markSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function markAttendance(input: z.infer<typeof markSchema>) {
  const { userId, organizationId } = await requireAdmin();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 세션이 우리 학원 것인지 검증
  const owned = (await sql`
    select id from class_sessions
    where id = ${d.sessionId} and organization_id = ${organizationId}
    limit 1
  `) as { id: string }[];
  if (!owned[0]) throw new Error("forbidden");

  await sql`
    insert into session_attendance (session_id, student_id, organization_id, status, marked_by, marked_at, note)
    values (${d.sessionId}, ${d.studentId}, ${organizationId},
            ${d.status}::session_attendance_status, ${userId}, now(),
            ${d.note || null})
    on conflict (session_id, student_id) do update
    set status = excluded.status,
        marked_by = excluded.marked_by,
        marked_at = excluded.marked_at,
        note = excluded.note
  `;
  revalidatePath(`/admin/sessions/${d.sessionId}`);
  revalidatePath("/admin/attendance");
}

const sessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "rescheduled"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function updateSessionStatus(input: z.infer<typeof sessionStatusSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = sessionStatusSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    update class_sessions
    set status = ${parsed.data.status},
        notes = ${parsed.data.notes || null}
    where id = ${parsed.data.sessionId} and organization_id = ${organizationId}
  `;
  revalidatePath(`/admin/sessions/${parsed.data.sessionId}`);
  revalidatePath("/admin/attendance");
}

const topicSchema = z.object({
  sessionId: z.string().uuid(),
  topic: z.string().max(200),
});

export async function updateSessionTopic(input: z.infer<typeof topicSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    update class_sessions
    set topic = ${parsed.data.topic || null}
    where id = ${parsed.data.sessionId} and organization_id = ${organizationId}
  `;
  revalidatePath(`/admin/sessions/${parsed.data.sessionId}`);
}
