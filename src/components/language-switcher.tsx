"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<string, string> = {
  ko: "한국어",
  vi: "Tiếng Việt",
};

export function LanguageSwitcher({
  className = "",
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const dark = variant === "dark";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full p-1 text-[11px] font-semibold ${
        dark ? "bg-white/10" : "bg-[var(--color-soft)]"
      } ${className}`}
    >
      {routing.locales.map((lng) => {
        const active = lng === locale;
        return (
          <button
            key={lng}
            type="button"
            disabled={isPending}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 transition ${
              active
                ? dark
                  ? "bg-white text-[var(--color-ink)]"
                  : "bg-[var(--color-ink)] text-white"
                : dark
                  ? "text-white/70 hover:text-white"
                  : "text-[var(--color-ink)] hover:bg-white"
            }`}
            onClick={() => {
              if (active) return;
              startTransition(() => {
                router.replace(pathname, { locale: lng });
              });
            }}
          >
            {labels[lng] ?? lng.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
