import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "vi"],
  defaultLocale: "ko",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
