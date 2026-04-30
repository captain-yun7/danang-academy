import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { authEdge } from "./auth-edge";

const intlMiddleware = createIntlMiddleware(routing);

export default authEdge((req) => {
  return intlMiddleware(req);
});

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
