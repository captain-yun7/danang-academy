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
  status: z.enum(["waiting", "active", "paused", "graduated", "dropped"]).default("active"),
  // 학번: 과제 파일명에 쓰이므로 영문/숫자/하이픈/언더스코어만 허용
  studentCode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional()
    .or(z.literal("")),
});

function vnYear(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date());
}

// 해당 학원·연도의 다음 학번을 계산한다. 형식: YYYY-NNNN
async function nextStudentCode(organizationId: string): Promise<string> {
  const year = vnYear();
  const rows = (await sql`
    select student_code from students
    where organization_id = ${organizationId}
      and student_code like ${`${year}-%`}
  `) as { student_code: string | null }[];
  let max = 0;
  for (const r of rows) {
    const m = /^(\d{4})-(\d+)$/.exec(r.student_code ?? "");
    if (m && m[1] === year) max = Math.max(max, parseInt(m[2], 10));
  }
  return `${year}-${String(max + 1).padStart(4, "0")}`;
}

// 같은 학원에 동일 학번이 이미 있는지 확인 (수정 시 본인 제외)
async function isStudentCodeTaken(
  organizationId: string,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const rows = (await sql`
    select id from students
    where organization_id = ${organizationId}
      and student_code = ${code}
      ${excludeId ? sql`and id <> ${excludeId}::uuid` : sql``}
    limit 1
  `) as { id: string }[];
  return !!rows[0];
}

export async function suggestStudentCode(): Promise<string> {
  const { user } = await requireAdmin();
  return nextStudentCode(user.organizationId);
}

export async function createStudent(input: z.infer<typeof createSchema>) {
  const { user } = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  const phone = normalizeVnPhone(d.phone) || null;
  const parentContact = normalizeVnPhone(d.parentContact) || null;

  // 학번: 입력값이 있으면 중복 검사, 비어있으면 자동 생성
  let studentCode = d.studentCode?.trim() || "";
  if (studentCode) {
    if (await isStudentCodeTaken(user.organizationId, studentCode)) {
      throw new Error("code_taken");
    }
  } else {
    studentCode = await nextStudentCode(user.organizationId);
  }

  const inserted = (await sql`
    insert into students
      (name, phone, native_language, korean_level, class_id, parent_contact, enrolled_at, status, student_code, organization_id)
    values
      (${d.name},
       ${phone},
       ${d.nativeLanguage}::native_language,
       ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
       ${d.classId ? d.classId : null}::uuid,
       ${parentContact},
       ${d.enrolledAt ? d.enrolledAt : null}::date,
       ${d.status}::student_status,
       ${studentCode},
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

  const studentCode = d.studentCode?.trim() || null;
  if (studentCode && (await isStudentCodeTaken(user.organizationId, studentCode, d.id))) {
    throw new Error("code_taken");
  }

  await sql`
    update students set
      name = ${d.name},
      phone = ${phone},
      native_language = ${d.nativeLanguage}::native_language,
      korean_level = ${d.koreanLevel ? d.koreanLevel : null}::korean_level,
      class_id = ${d.classId ? d.classId : null}::uuid,
      parent_contact = ${parentContact},
      enrolled_at = ${d.enrolledAt ? d.enrolledAt : null}::date,
      status = ${d.status}::student_status,
      student_code = ${studentCode}
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
