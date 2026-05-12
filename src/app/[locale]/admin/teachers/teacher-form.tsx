"use client";

import { useState, useTransition } from "react";
import { createTeacher } from "./actions";

const ROLES = [
  { value: "teacher", label: "강사" },
  { value: "manager", label: "매니저" },
  { value: "owner", label: "원장" },
] as const;

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export function TeacherForm({ sessionRole }: { sessionRole: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 역할 옵션 — 본인 권한에 따라 필터링
  const availableRoles = ROLES.filter((r) => {
    if (sessionRole === "manager") return r.value === "teacher";
    if (sessionRole === "owner") return r.value !== "owner";
    return true; // super_admin
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
          targetRole: fd.get("targetRole") as "teacher" | "manager" | "owner",
        };
        if (payload.password.length < 8) {
          setError("비밀번호는 8자 이상이어야 합니다.");
          return;
        }
        startTransition(async () => {
          try {
            await createTeacher(payload);
            setGenerated(payload.password); // 등록한 비번을 표시 (사장한테 알려주기 위해)
            (e.target as HTMLFormElement).reset();
            setTimeout(() => setGenerated(null), 60_000); // 1분 후 숨김
          } catch (err) {
            const msg = err instanceof Error ? err.message : "오류";
            setError(
              msg === "email_taken"
                ? "이미 사용 중인 이메일입니다."
                : msg.startsWith("forbidden")
                  ? "이 역할을 등록할 권한이 없습니다."
                  : "등록 실패: " + msg
            );
          }
        });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            이름 <span className="text-red-500">*</span>
          </span>
          <input
            name="name"
            required
            maxLength={60}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">역할</span>
          <select
            name="targetRole"
            defaultValue="teacher"
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
          >
            {availableRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            이메일 <span className="text-red-500">*</span>
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
          <span className="mb-1 block text-xs font-semibold">연락처</span>
          <input
            name="phone"
            type="tel"
            placeholder="+84 ..."
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          />
        </label>
      </div>

      <PasswordField randomFn={randomPassword} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {generated && (
        <div className="rounded-md bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
          <p className="font-bold">✓ 등록 완료!</p>
          <p className="mt-1">
            초기 비밀번호: <code className="rounded bg-white px-2 py-0.5 font-mono">{generated}</code>
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
              {copied ? "복사됨 ✓" : "복사"}
            </button>
          </p>
          <p className="mt-1 text-[10px]">
            ⚠️ 이 비밀번호는 한 번만 표시됩니다. 강사에게 안전한 채널로 전달하세요.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient self-start rounded-full px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "등록 중..." : "+ 등록"}
      </button>
    </form>
  );
}

function PasswordField({ randomFn }: { randomFn: () => string }) {
  const [value, setValue] = useState("");
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">
        초기 비밀번호 (8자 이상) <span className="text-red-500">*</span>
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
          🎲 랜덤
        </button>
      </div>
      <p className="mt-1 text-[10px] text-[var(--color-muted)]">
        강사가 로그인 후 자기 비번으로 바꾸도록 안내하세요.
      </p>
    </label>
  );
}
