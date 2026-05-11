"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { generateSessions } from "@/lib/sessions/generator";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, organizationId };
}

const DAY_VALUES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const recurringSchema = z
  .object({
    days: z.array(z.enum(DAY_VALUES)).default([]),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  })
  .optional();

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  level: z.enum(["beginner", "elementary", "intermediate", "advanced"]),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  schedule: z.string().trim().max(120).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(100).default(10),
  recurringPattern: recurringSchema,
});

export async function createClass(input: z.infer<typeof schema>) {
  const { organizationId } = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;
  const pattern = normalizePattern(d.recurringPattern);
  const inserted = (await sql`
    insert into classes (name, level, teacher_id, schedule, capacity, recurring_pattern, organization_id)
    values (${d.name}, ${d.level}::korean_level,
            ${d.teacherId ? d.teacherId : null}::uuid,
            ${d.schedule || null},
            ${d.capacity},
            ${JSON.stringify(pattern)}::jsonb,
            ${organizationId})
    returning id::text
  `) as { id: string }[];
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  redirect(`/admin/classes/${inserted[0].id}`);
}

const updateSchema = schema.extend({ id: z.string().uuid() });
export async function updateClass(input: z.infer<typeof updateSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;
  const pattern = normalizePattern(d.recurringPattern);
  await sql`
    update classes set
      name = ${d.name},
      level = ${d.level}::korean_level,
      teacher_id = ${d.teacherId ? d.teacherId : null}::uuid,
      schedule = ${d.schedule || null},
      capacity = ${d.capacity},
      recurring_pattern = ${JSON.stringify(pattern)}::jsonb
    where id = ${d.id} and organization_id = ${organizationId}
  `;
  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${d.id}`);
}

export async function deleteClass(id: string) {
  const { organizationId } = await requireAdmin();
  await sql`delete from classes where id = ${id} and organization_id = ${organizationId}`;
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  redirect("/admin/classes");
}

const genSchema = z.object({
  classId: z.string().uuid(),
  weeks: z.coerce.number().int().min(1).max(12).default(4),
});

export async function generateUpcomingSessions(
  input: z.infer<typeof genSchema>
): Promise<{ generated: number; skipped: number }> {
  const { organizationId } = await requireAdmin();
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const res = await generateSessions({
    classId: parsed.data.classId,
    organizationId,
    weeks: parsed.data.weeks,
  });
  revalidatePath(`/admin/classes/${parsed.data.classId}`);
  revalidatePath("/admin/attendance");
  return res;
}

function normalizePattern(p?: z.infer<typeof recurringSchema>) {
  if (!p) return {};
  const days = p.days ?? [];
  const start = p.start_time && p.start_time !== "" ? p.start_time : undefined;
  const end = p.end_time && p.end_time !== "" ? p.end_time : undefined;
  if (days.length === 0 || !start || !end) return {};
  return { days, start_time: start, end_time: end };
}
