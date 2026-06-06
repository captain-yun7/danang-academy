"use client";

import { use, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { studentSignIn } from "../actions";

export function StudentLoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const t = useTranslations("studentPortal.login");
  const sp = use(searchParamsPromise);
  const [error, setError] = useState<string | null>(sp.error ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await studentSignIn({
            studentCode: String(fd.get("studentCode") ?? "").trim(),
            password: String(fd.get("password") ?? ""),
            callbackUrl: sp.callbackUrl,
          });
          if (res?.error) setError(t("error"));
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("studentCode")}</span>
        <input
          name="studentCode"
          required
          autoComplete="username"
          placeholder={t("studentCodePlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("password")}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-2 w-full rounded-full px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
      <p className="text-center text-[11px] text-[var(--color-muted)]">{t("hint")}</p>
    </form>
  );
}
