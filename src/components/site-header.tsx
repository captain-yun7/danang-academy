"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { primaryNavSlugs, secondaryNavSlugs, contact } from "@/lib/site";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const tSite = useTranslations("site");
  const tNav = useTranslations("nav");

  const secondary = secondaryNavSlugs.filter((s) => s.key !== "home");

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {/* Topbar */}
      <div className="hidden border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs text-[var(--color-muted)] md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          <span>
            📞 {contact.phone} · ✉️ {contact.email}
          </span>
          <div className="flex items-center gap-4">
            <span>{tSite("hours")}</span>
            <LanguageSwitcher />
            <Link
              href="/admin"
              className="rounded-full bg-white px-3 py-1 font-semibold text-[var(--color-ink)] hover:bg-[var(--color-primary)] hover:text-white"
            >
              {tSite("admin")}
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex h-20 max-w-7xl items-center px-6">
        <Link href="/" className="flex items-center" aria-label={tSite("name")}>
          <Image
            src="/logo.png"
            alt={tSite("name")}
            width={220}
            height={56}
            priority
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {primaryNavSlugs.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary-deep)]"
            >
              {tNav(`primary.${n.key}`)}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-[var(--color-line)]" aria-hidden />
          {secondary.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              {tNav(`secondary.${n.key}`)}
            </Link>
          ))}
          <Link
            href="/free-pronunciation"
            className="ml-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-primary-deep)]"
          >
            {tNav("ctaFreeTest")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <Link
            href="/free-pronunciation"
            className="rounded-full bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-white"
          >
            {tNav("ctaFreeTestShort")}
          </Link>
          <button
            type="button"
            aria-label={tNav("menu")}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-line)]"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{tNav("menu")}</span>
            <div className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-[var(--color-ink)]" />
              <span className="block h-0.5 w-5 bg-[var(--color-ink)]" />
              <span className="block h-0.5 w-5 bg-[var(--color-ink)]" />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-[var(--color-line)] bg-white lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-0.5 px-4 py-4">
            {primaryNavSlugs.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline justify-between rounded-md px-3 py-3 hover:bg-[var(--color-soft)]"
              >
                <span className="text-sm font-semibold">{tNav(`primary.${n.key}`)}</span>
              </Link>
            ))}
            <hr className="my-2 border-[var(--color-line)]" />
            {secondary.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[var(--color-soft)]"
              >
                {tNav(`secondary.${n.key}`)}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-md border border-[var(--color-line)] px-3 py-2.5 text-center text-xs font-bold"
            >
              {tSite("admin")}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
