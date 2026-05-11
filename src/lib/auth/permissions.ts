/**
 * RBAC 권한 매트릭스 — 학원 ERP 표준 정책
 */

import { auth } from "@/auth";

export type Role = "super_admin" | "owner" | "manager" | "teacher" | "student" | "visitor";

export type Action =
  // 학생
  | "students:read:all"          // 모든 학생 보기
  | "students:read:own_classes"  // 자기 반 학생만
  | "students:create"
  | "students:update"
  | "students:delete"
  | "students:note"              // 메모 작성/수정
  // 반
  | "classes:read:all"
  | "classes:read:own"           // 자기가 담당하는 반만
  | "classes:create"
  | "classes:update"
  | "classes:delete"
  // 수업 회차
  | "sessions:read:all"
  | "sessions:read:own"
  | "sessions:mark_attendance:all"
  | "sessions:mark_attendance:own"
  | "sessions:reschedule"
  // 강사·사용자
  | "users:read"
  | "users:create:teacher"
  | "users:create:manager"
  | "users:create:owner"
  | "users:update_role"
  | "users:pay"                  // 강사 페이/시급
  // 상담·테스트
  | "leads:read"
  | "leads:update_status"
  | "tests:read:all"
  | "tests:read:own_classes"
  // MCQ
  | "mcq:read"
  | "mcq:write"
  | "mcq:thresholds"
  // 시스템
  | "org:settings"               // 학원 설정 (로고/이름/플랜)
  | "billing:read"
  | "billing:write"
  | "system:settings";           // 슈퍼어드민 전용

const MATRIX: Record<Action, Role[]> = {
  "students:read:all":          ["super_admin", "owner", "manager"],
  "students:read:own_classes":  ["super_admin", "owner", "manager", "teacher"],
  "students:create":            ["super_admin", "owner", "manager"],
  "students:update":            ["super_admin", "owner", "manager"],
  "students:delete":            ["super_admin", "owner"],
  "students:note":              ["super_admin", "owner", "manager", "teacher"],

  "classes:read:all":           ["super_admin", "owner", "manager"],
  "classes:read:own":           ["super_admin", "owner", "manager", "teacher"],
  "classes:create":             ["super_admin", "owner", "manager"],
  "classes:update":             ["super_admin", "owner", "manager"],
  "classes:delete":             ["super_admin", "owner"],

  "sessions:read:all":          ["super_admin", "owner", "manager"],
  "sessions:read:own":          ["super_admin", "owner", "manager", "teacher"],
  "sessions:mark_attendance:all":  ["super_admin", "owner", "manager"],
  "sessions:mark_attendance:own":  ["super_admin", "owner", "manager", "teacher"],
  "sessions:reschedule":        ["super_admin", "owner", "manager", "teacher"],

  "users:read":                 ["super_admin", "owner", "manager"],
  "users:create:teacher":       ["super_admin", "owner", "manager"],
  "users:create:manager":       ["super_admin", "owner"],
  "users:create:owner":         ["super_admin"],
  "users:update_role":          ["super_admin", "owner"],
  "users:pay":                  ["super_admin", "owner"],

  "leads:read":                 ["super_admin", "owner", "manager"],
  "leads:update_status":        ["super_admin", "owner", "manager"],
  "tests:read:all":             ["super_admin", "owner", "manager"],
  "tests:read:own_classes":     ["super_admin", "owner", "manager", "teacher"],

  "mcq:read":                   ["super_admin", "owner", "manager", "teacher"],
  "mcq:write":                  ["super_admin", "owner", "manager"],
  "mcq:thresholds":             ["super_admin", "owner", "manager"],

  "org:settings":               ["super_admin", "owner"],
  "billing:read":               ["super_admin", "owner", "manager"],
  "billing:write":              ["super_admin", "owner"],
  "system:settings":            ["super_admin"],
};

export function can(role: Role | undefined | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action]?.includes(role) ?? false;
}

/** 현재 로그인 사용자가 권한 있는지 */
export async function currentCan(action: Action): Promise<boolean> {
  const session = await auth();
  const role = (session?.user as { role?: Role } | undefined)?.role;
  return can(role, action);
}

/** 권한 없으면 throw — 서버 액션 진입부에 한 줄로 */
export async function requirePermission(action: Action): Promise<{
  role: Role;
  userId: string;
  organizationId: string;
}> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: Role; organizationId?: string }
    | undefined;
  if (!user?.role || !user.id || !user.organizationId) {
    throw new Error("unauthenticated");
  }
  if (!can(user.role, action)) {
    throw new Error(`forbidden: ${action} requires role to include in ${MATRIX[action].join("|")}`);
  }
  return { role: user.role, userId: user.id, organizationId: user.organizationId };
}
