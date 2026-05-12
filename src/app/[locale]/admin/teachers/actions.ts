"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireRoleOrAbove(min: "manager" | "owner" | "super_admin") {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId) throw new Error("forbidden");

  const order = ["teacher", "manager", "owner", "super_admin"];
  if (order.indexOf(role) < order.indexOf(min)) throw new Error("forbidden");
  return { role, organizationId };
}

const ALLOWED_ROLES = ["teacher", "manager", "owner"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(8).max(80),
  targetRole: z.enum(ALLOWED_ROLES).default("teacher"),
});

export async function createTeacher(input: z.infer<typeof createSchema>) {
  const session = await requireRoleOrAbove("manager");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 역할별 등록 가능 범위
  // manager → teacher만
  // owner   → teacher/manager
  // super_admin → teacher/manager/owner
  const canAssign: Record<string, AllowedRole[]> = {
    manager: ["teacher"],
    owner: ["teacher", "manager"],
    super_admin: ["teacher", "manager", "owner"],
  };
  if (!canAssign[session.role]?.includes(d.targetRole)) {
    throw new Error(`forbidden: cannot assign role '${d.targetRole}'`);
  }

  // 이메일 중복 체크 (전체 시스템)
  const dup = (await sql`select id from users where email = ${d.email} limit 1`) as { id: string }[];
  if (dup[0]) throw new Error("email_taken");

  const hash = await bcrypt.hash(d.password, 10);
  await sql`
    insert into users (email, password_hash, name, phone, role, organization_id, email_verified)
    values (${d.email}, ${hash}, ${d.name}, ${d.phone || null},
            ${d.targetRole}::user_role, ${session.organizationId}, now())
  `;

  revalidatePath("/admin/teachers");
}

const resetSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8).max(80),
});

export async function resetTeacherPassword(input: z.infer<typeof resetSchema>) {
  const session = await requireRoleOrAbove("manager");
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");

  const hash = await bcrypt.hash(parsed.data.password, 10);
  await sql`
    update users
    set password_hash = ${hash}
    where id = ${parsed.data.id} and organization_id = ${session.organizationId}
  `;
  revalidatePath("/admin/teachers");
}

const updateRoleSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(ALLOWED_ROLES),
});

export async function updateTeacherRole(input: z.infer<typeof updateRoleSchema>) {
  const session = await requireRoleOrAbove("owner");
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");

  // 자기 자신은 변경 못 함 (실수로 권한 박탈 방지)
  const sessionUserId = (await auth())?.user?.email;
  if (!sessionUserId) throw new Error("unauthenticated");

  await sql`
    update users
    set role = ${parsed.data.role}::user_role
    where id = ${parsed.data.id} and organization_id = ${session.organizationId}
  `;
  revalidatePath("/admin/teachers");
}

export async function deleteTeacher(id: string) {
  const session = await requireRoleOrAbove("owner");
  // 본인 삭제 방지
  const current = await auth();
  const currentId = (current?.user as { id?: string } | undefined)?.id;
  if (currentId === id) throw new Error("cannot_delete_self");

  // 강사가 담당하는 반의 teacher_id를 null로 (FK는 set null 이미 됨)
  await sql`
    delete from users
    where id = ${id} and organization_id = ${session.organizationId}
  `;
  revalidatePath("/admin/teachers");
}
