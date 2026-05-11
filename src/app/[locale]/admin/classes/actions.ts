"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, organizationId };
}

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  level: z.enum(["beginner", "elementary", "intermediate", "advanced"]),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  schedule: z.string().trim().max(120).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(100).default(10),
});

export async function createClass(input: z.infer<typeof schema>) {
  const { organizationId } = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;
  const inserted = (await sql`
    insert into classes (name, level, teacher_id, schedule, capacity, organization_id)
    values (${d.name}, ${d.level}::korean_level,
            ${d.teacherId ? d.teacherId : null}::uuid,
            ${d.schedule || null},
            ${d.capacity},
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
  await sql`
    update classes set
      name = ${d.name},
      level = ${d.level}::korean_level,
      teacher_id = ${d.teacherId ? d.teacherId : null}::uuid,
      schedule = ${d.schedule || null},
      capacity = ${d.capacity}
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
