"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startPlacementTest } from "./actions";

const LANG_KEYS = ["vi", "en", "other"] as const;

export function StartForm() {
  const t = useTranslations("pt");
  const tLang = useTranslations("fpt.languages");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await startPlacementTest({
            visitorName: String(fd.get("name") ?? ""),
            nativeLanguage: fd.get("nativeLanguage") as "vi" | "en" | "other",
          });
          if (!res.ok) {
            setError(
              res.error === "rate_limited"
                ? t("form.errorRate")
                : res.error === "no_questions"
                  ? t("form.errorNoQuestions")
                  : t("form.errorInvalid")
            );
            return;
          }
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              `pt:${res.id}:questions`,
              JSON.stringify(res.questions)
            );
          }
          router.push(`/placement/${res.id}/mcq`);
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {t("form.name")} <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={60}
          placeholder={t("form.namePlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form.nativeLanguage")}</span>
        <select
          name="nativeLanguage"
          defaultValue="vi"
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {LANG_KEYS.map((k) => (
            <option key={k} value={k}>
              {tLang(k)}
            </option>
          ))}
        </select>
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
        {pending ? t("form.submitting") : t("form.submit")}
      </button>
    </form>
  );
}
