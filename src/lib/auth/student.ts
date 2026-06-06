import { auth } from "@/auth";

export type StudentSession = {
  studentId: string;
  organizationId: string;
  studentCode: string | null;
  name: string;
};

// 학생 세션 강제 — 학생이 아니면 throw. 서버 액션/페이지에서 소유권 스코프에 사용.
export async function requireStudent(): Promise<StudentSession> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; role?: string; organizationId?: string; studentCode?: string; name?: string }
    | undefined;
  if (!u?.id || u.role !== "student" || !u.organizationId) {
    throw new Error("forbidden");
  }
  return {
    studentId: u.id,
    organizationId: u.organizationId,
    studentCode: u.studentCode ?? null,
    name: u.name ?? "",
  };
}

export async function getStudentSession(): Promise<StudentSession | null> {
  try {
    return await requireStudent();
  } catch {
    return null;
  }
}
