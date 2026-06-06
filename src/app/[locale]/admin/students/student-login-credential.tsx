"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setStudentPassword } from "./actions";

export function StudentLoginCredential({
  studentId,
  studentCode,
  hasPassword,
}: {
  studentId: string;
  studentCode: string | null;
  hasPassword: boolean;
}) {
  const t = useTranslations("admin.students.login");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  if (!studentCode) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
          {t("title")}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">{t("needCode")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("title")}
      </p>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        {t("loginIdLabel")}{" "}
        <span className="font-mono font-semibold text-[var(--color-ink)]">{studentCode}</span>
      </p>
      <p className="mt-1 text-xs">
        {hasPassword ? (
          <span className="font-semibold text-emerald-600">● {t("statusSet")}</span>
        ) : (
          <span className="font-semibold text-amber-600">● {t("statusUnset")}</span>
        )}
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
            setError(null);
          }}
          className="mt-3 rounded-full border-2 border-[var(--color-line)] px-4 py-1.5 text-xs font-bold hover:border-[var(--color-primary)]"
        >
          {hasPassword ? t("reset") : t("issue")}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            startTransition(async () => {
              try {
                await setStudentPassword({ id: studentId, password });
                setSaved(true);
                setOpen(false);
                setPassword("");
              } catch (err) {
                const msg = err instanceof Error ? err.message : "error";
                setError(msg === "invalid_input" ? t("tooShort") : t("genericError"));
              }
            });
          }}
          className="mt-3 grid gap-2"
        >
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            maxLength={72}
            required
            autoComplete="new-password"
            placeholder={t("placeholder")}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
              className="rounded-full border-2 border-[var(--color-line)] px-4 py-1.5 text-xs font-bold"
            >
              {t("cancel")}
            </button>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">{t("hint")}</p>
        </form>
      )}

      {saved && (
        <p className="mt-2 text-xs font-semibold text-emerald-600">✓ {t("saved")}</p>
      )}
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
