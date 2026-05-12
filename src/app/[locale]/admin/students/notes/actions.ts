"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireUser() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !userId || !organizationId) throw new Error("forbidden");
  if (!["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, userId, organizationId };
}

const CATEGORIES = [
  "general",
  "pronunciation",
  "attendance",
  "progress",
  "behavior",
] as const;

const createSchema = z.object({
  studentId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
  category: z.enum(CATEGORIES).default("general"),
});

export async function addStudentNote(input: z.infer<typeof createSchema>) {
  const { userId, organizationId } = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");

  // 학생이 우리 학원 소속인지 검증
  const owned = (await sql`
    select id from students
    where id = ${parsed.data.studentId} and organization_id = ${organizationId}
    limit 1
  `) as { id: string }[];
  if (!owned[0]) throw new Error("forbidden");

  await sql`
    insert into student_notes (student_id, organization_id, author_id, content, category)
    values (${parsed.data.studentId}, ${organizationId}, ${userId},
            ${parsed.data.content}, ${parsed.data.category})
  `;
  revalidatePath(`/admin/students/${parsed.data.studentId}`);
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteStudentNote(input: z.infer<typeof deleteSchema>) {
  const { role, userId, organizationId } = await requireUser();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");

  // 작성자 본인 또는 manager+만 삭제 가능
  const rows = (await sql`
    select author_id::text, student_id::text
    from student_notes
    where id = ${parsed.data.id} and organization_id = ${organizationId}
    limit 1
  `) as { author_id: string | null; student_id: string }[];
  if (!rows[0]) throw new Error("not_found");

  const isAuthor = rows[0].author_id === userId;
  const isManagerPlus = ["super_admin", "owner", "manager"].includes(role);
  if (!isAuthor && !isManagerPlus) throw new Error("forbidden");

  await sql`
    delete from student_notes
    where id = ${parsed.data.id} and organization_id = ${organizationId}
  `;
  revalidatePath(`/admin/students/${rows[0].student_id}`);
}
