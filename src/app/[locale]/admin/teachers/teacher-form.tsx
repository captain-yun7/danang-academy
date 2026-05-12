"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createTeacher } from "./actions";
import { PhoneInput } from "@/components/phone-input";

const ROLE_KEYS = ["teacher", "manager", "owner"] as const;
type RoleKey = (typeof ROLE_KEYS)[number];

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export function TeacherForm({ sessionRole }: { sessionRole: string }) {
  const t = useTranslations("admin.teachers.form");
  const tRoles = useTranslations("admin.teachers.roles");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const availableRoles = ROLE_KEYS.filter((r) => {
    if (sessionRole === "manager") return r === "teacher";
    if (sessionRole === "owner") return r !== "owner";
    return true;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setCopied(false);
        const fd = new FormData(e.currentTarget);
        const payload = {
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          password: String(fd.get("password") ?? ""),
          targetRole: fd.get("targetRole") as RoleKey,
        };
        if (payload.password.length < 8) {
          setError(t("errorMinLength"));
          return;
        }
        startTransition(async () => {
          try {
            await createTeacher(payload);
            setGenerated(payload.password);
            (e.target as HTMLFormElement).reset();
            setTimeout(() => setGenerated(null), 60_000);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "error";
            setError(
              msg === "email_taken"
                ? t("errorEmailTaken")
                : msg.startsWith("forbidden")
                  ? t("errorForbidden")
                  : `${t("errorPrefix")} ${msg}`
            );
          }
        });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            {t("name")} <span className="text-red-500">*</span>
          </span>
          <input
            name="name"
            required
            maxLength={60}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("role")}</span>
          <select
            name="targetRole"
            defaultValue="teacher"
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            {t("email")} <span className="text-red-500">*</span>
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="teacher@example.com"
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("phone")}</span>
          <PhoneInput name="phone" />
        </label>
      </div>

      <PasswordField passwordLabel={t("password")} passwordHint={t("passwordHint")} randomLabel={t("passwordRandom")} randomFn={randomPassword} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {generated && (
        <div className="rounded-md bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
          <p className="font-bold">{t("successTitle")}</p>
          <p className="mt-1">
            {t("successInitialPw")}{" "}
            <code className="rounded bg-white px-2 py-0.5 font-mono">{generated}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generated).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="ml-2 underline"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </p>
          <p className="mt-1 text-[10px]">{t("warningOnce")}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient self-start rounded-full px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t("creating") : t("createBtn")}
      </button>
    </form>
  );
}

function PasswordField({
  passwordLabel,
  passwordHint,
  randomLabel,
  randomFn,
}: {
  passwordLabel: string;
  passwordHint: string;
  randomLabel: string;
  randomFn: () => string;
}) {
  const [value, setValue] = useState("");
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">
        {passwordLabel} <span className="text-red-500">*</span>
      </span>
      <div className="flex gap-2">
        <input
          name="password"
          required
          minLength={8}
          maxLength={80}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-primary)]"
        />
        <button
          type="button"
          onClick={() => setValue(randomFn())}
          className="rounded-lg border-2 border-[var(--color-line)] px-3 py-2 text-xs font-bold hover:border-[var(--color-ink)]"
        >
          {randomLabel}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-[var(--color-muted)]">{passwordHint}</p>
    </label>
  );
}
