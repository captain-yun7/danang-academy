"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<string, string> = {
  ko: "한국어",
  vi: "Tiếng Việt",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--color-soft)] p-1 text-[11px] font-semibold ${className}`}
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
                ? "bg-[var(--color-ink)] text-white"
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
