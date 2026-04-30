"use client";

import { use, useState, useTransition } from "react";
import { signInWithCredentials } from "./actions";

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
}) {
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
          const res = await signInWithCredentials({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
            callbackUrl: sp.callbackUrl,
          });
          if (res?.error) setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">이메일</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">비밀번호</span>
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
        {pending ? "로그인 중..." : "로그인 →"}
      </button>
    </form>
  );
}
