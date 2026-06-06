"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { studentSignOut } from "./actions";

export function PortalHeader({
  name,
  code,
}: {
  name: string;
  code: string | null;
}) {
  const t = useTranslations("studentPortal");
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-white">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <Link href="/student" className="flex items-center gap-2">
          <span className="brand-gradient-text text-lg font-black">{t("brand")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold leading-tight">{name}</p>
            {code && <p className="font-mono text-[11px] text-[var(--color-muted)]">{code}</p>}
          </div>
          <LanguageSwitcher />
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => studentSignOut())}
            className="rounded-full border-2 border-[var(--color-line)] px-3 py-1.5 text-xs font-bold hover:border-[var(--color-ink)] disabled:opacity-50"
          >
            {t("logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
