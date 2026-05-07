"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return session!;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  nativeLanguage: z.enum(["vi", "en", "other"]).default("vi"),
  koreanLevel: z
    .enum(["beginner", "elementary", "intermediate", "advanced"])
    .optional()
    .or(z.literal("")),
  classId: z.string().uuid().optional().or(z.literal("")),
  parentContact: z.string().trim().max(120).optional().or(z.literal("")),
  enrolledAt: z.string().optional().or(z.literal("")),
});

export async function createStudent(input: z.infer<typeof createSchema>) {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const inserted = (await sql`
    insert into students
      (name, phone, native_language, korean_level, class_id, parent_contact, enrolled_at)
    values
      (${d.name},
       ${d.phone || null},
       ${d.nativeLanguage}::native_language,
       ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
       ${d.classId ? d.classId : null}::uuid,
       ${d.parentContact || null},
       ${d.enrolledAt ? d.enrolledAt : null}::date)
    returning id::text
  `) as { id: string }[];

  revalidatePath("/admin/students");
  revalidatePath("/admin");
  redirect(`/admin/students/${inserted[0].id}`);
}

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

export async function updateStudent(input: z.infer<typeof updateSchema>) {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  await sql`
    update students set
      name = ${d.name},
      phone = ${d.phone || null},
      native_language = ${d.nativeLanguage}::native_language,
      korean_level = ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
      class_id = ${d.classId ? d.classId : null}::uuid,
      parent_contact = ${d.parentContact || null},
      enrolled_at = ${d.enrolledAt ? d.enrolledAt : null}::date
    where id = ${d.id}
  `;

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${d.id}`);
}

export async function deleteStudent(id: string) {
  await requireAdmin();
  await sql`delete from students where id = ${id}`;
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  redirect("/admin/students");
}
