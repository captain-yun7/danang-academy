import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminPath = nextUrl.pathname.includes("/admin");
      if (isAdminPath) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.organizationId = (user as { organizationId?: string }).organizationId;
        token.studentCode = (user as { studentCode?: string }).studentCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          id?: string;
          role?: string;
          organizationId?: string;
          studentCode?: string;
        };
        u.id = token.id as string;
        u.role = token.role as string;
        u.organizationId = token.organizationId as string;
        u.studentCode = token.studentCode as string | undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
