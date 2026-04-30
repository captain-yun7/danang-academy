import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge 호환 — providers 없이 authorized 콜백만 사용 (미들웨어용)
export const { auth: authEdge } = NextAuth(authConfig);
