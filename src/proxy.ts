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
  const isLoggedIn = !!req.auth;

  if (isAdmin && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
