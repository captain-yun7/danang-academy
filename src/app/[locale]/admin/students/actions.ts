"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { normalizeVnPhone } from "@/lib/phone";

type Session = { user: { role: string; organizationId: string } };

async function requireAdmin(): Promise<Session> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return { user: { role, organizationId } };
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
  status: z.enum(["active", "paused", "graduated", "dropped"]).default("active"),
});

export async function createStudent(input: z.infer<typeof createSchema>) {
  const { user } = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const phone = normalizeVnPhone(d.phone) || null;
  const parentContact = normalizeVnPhone(d.parentContact) || null;

  const inserted = (await sql`
    insert into students
      (name, phone, native_language, korean_level, class_id, parent_contact, enrolled_at, status, organization_id)
    values
      (${d.name},
       ${phone},
       ${d.nativeLanguage}::native_language,
       ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
       ${d.classId ? d.classId : null}::uuid,
       ${parentContact},
       ${d.enrolledAt ? d.enrolledAt : null}::date,
       ${d.status}::student_status,
       ${user.organizationId})
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
  const { user } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const phone = normalizeVnPhone(d.phone) || null;
  const parentContact = normalizeVnPhone(d.parentContact) || null;

  await sql`
    update students set
      name = ${d.name},
      phone = ${phone},
      native_language = ${d.nativeLanguage}::native_language,
      korean_level = ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
      class_id = ${d.classId ? d.classId : null}::uuid,
      parent_contact = ${parentContact},
      enrolled_at = ${d.enrolledAt ? d.enrolledAt : null}::date,
      status = ${d.status}::student_status
    where id = ${d.id} and organization_id = ${user.organizationId}
  `;

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${d.id}`);
}

export async function deleteStudent(id: string) {
  const { user } = await requireAdmin();
  await sql`delete from students where id = ${id} and organization_id = ${user.organizationId}`;
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  redirect("/admin/students");
}
