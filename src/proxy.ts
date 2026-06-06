import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { authEdge } from "./auth-edge";

const intlMiddleware = createIntlMiddleware(routing);

export default authEdge((req) => {
  const path = req.nextUrl.pathname;
  // 로케일 prefix 제거한 경로 체크 (/ko/admin → /admin, /vi/admin → /admin)
  const stripped = path.replace(/^\/(ko|vi)(?=\/|$)/, "") || "/";
  const isAdmin = stripped.startsWith("/admin");
  const isStudentArea = stripped.startsWith("/student");
  const isStudentLogin = stripped === "/student/login";
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const isStudent = role === "student";

  // 어드민 영역: 로그인 필요 + 학생은 차단
  if (isAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (isStudent) {
      return NextResponse.redirect(new URL("/student", req.url));
    }
  }

  // 학생 포털: 학생 로그인 필요 (로그인 페이지는 예외)
  if (isStudentArea && !isStudentLogin && !isStudent) {
    const loginUrl = new URL("/student/login", req.url);
    if (isLoggedIn) {
      // 어드민이 학생 영역 접근 → 그냥 학생 로그인으로
      return NextResponse.redirect(loginUrl);
    }
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
