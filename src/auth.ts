import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getPool } from "./lib/db/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const studentSchema = z.object({
  studentCode: z.string().trim().min(1).max(32),
  password: z.string().min(1),
});

type DbUser = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role: string;
  image: string | null;
  organization_id: string;
};

async function getUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbUser>(
    "select id, email, password_hash, name, role, image, organization_id from users where email = $1 limit 1",
    [email]
  );
  return rows[0] ?? null;
}

type DbStudent = {
  id: string;
  name: string;
  password_hash: string | null;
  organization_id: string;
  student_code: string | null;
};

// 학번은 학원 단위 유니크 — Phase 1 단일 org 이므로 코드로 직접 조회.
// 여러 org 충돌 시(다중 테넌트 확장 시) 모호하므로 거부한다.
async function getStudentsByCode(code: string): Promise<DbStudent[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbStudent>(
    "select id, name, password_hash, organization_id, student_code from students where student_code = $1",
    [code]
  );
  return rows;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await getUserByEmail(parsed.data.email);
        if (!user || !user.password_hash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: user.role,
          organizationId: user.organization_id,
        };
      },
    }),
    Credentials({
      id: "student",
      async authorize(raw) {
        const parsed = studentSchema.safeParse(raw);
        if (!parsed.success) return null;

        const rows = await getStudentsByCode(parsed.data.studentCode);
        if (rows.length !== 1) return null; // 없음 또는 다중 org 충돌
        const student = rows[0];
        if (!student.password_hash) return null;

        const ok = await bcrypt.compare(parsed.data.password, student.password_hash);
        if (!ok) return null;

        return {
          id: student.id,
          name: student.name,
          role: "student",
          organizationId: student.organization_id,
          studentCode: student.student_code ?? undefined,
        };
      },
    }),
  ],
});
