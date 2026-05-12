"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitConsult } from "./actions";

const LEVEL_KEYS = ["beginner", "elementary", "intermediate", "advanced"] as const;

export function ConsultForm({
  source,
  sourceTestId,
  recommendedLevel,
}: {
  source: string;
  sourceTestId?: string;
  recommendedLevel?: string;
}) {
  const t = useTranslations("consultPage.form");
  const tLevels = useTranslations("levelLabels");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl">{t("successEmoji")}</p>
        <p className="mt-2 text-base font-bold text-emerald-700">
          {t("successTitle")}
        </p>
        <p className="mt-1 text-sm text-emerald-700/80">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const level = String(fd.get("level") ?? "");
        startTransition(async () => {
          const res = await submitConsult({
            name: String(fd.get("name") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            email: String(fd.get("email") ?? ""),
            recommendedLevel: level
              ? (level as "beginner" | "elementary" | "intermediate" | "advanced")
              : undefined,
            source,
            sourceTestId: sourceTestId,
            note: String(fd.get("note") ?? ""),
          });
          if (!res.ok) setError(t("errorInvalid"));
          else setDone(true);
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {t("name")} <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={60}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            {t("phone")} <span className="text-red-500">*</span>
          </span>
          <input
            name="phone"
            required
            type="tel"
            placeholder={t("phonePlaceholder")}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("email")}</span>
          <input
            name="email"
            type="email"
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("desiredClass")}</span>
        <select
          name="level"
          defaultValue={recommendedLevel ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          <option value="">{t("classNone")}</option>
          {LEVEL_KEYS.map((k) => (
            <option key={k} value={k}>
              {tLevels(k)}
            </option>
          ))}
        </select>
        {recommendedLevel && (
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {t("prefillHint")}
          </p>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("note")}</span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
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
    </form>
  );
}
