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

type DbUser = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role: string;
  image: string | null;
};

async function getUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbUser>(
    "select id, email, password_hash, name, role, image from users where email = $1 limit 1",
    [email]
  );
  return rows[0] ?? null;
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
        };
      },
    }),
  ],
});
