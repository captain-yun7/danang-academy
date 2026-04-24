import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 정적 파일과 API 제외, 나머지 모두 i18n 라우팅 적용
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
