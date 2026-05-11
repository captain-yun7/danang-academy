"use client";

import { useState, useTransition } from "react";
import { submitConsult } from "./actions";

const LEVELS = [
  { value: "", label: "선택 안 함" },
  { value: "beginner", label: "입문반" },
  { value: "elementary", label: "초급반" },
  { value: "intermediate", label: "중급반" },
  { value: "advanced", label: "고급반" },
] as const;

export function ConsultForm({
  source,
  sourceTestId,
  recommendedLevel,
}: {
  source: string;
  sourceTestId?: string;
  recommendedLevel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-base font-bold text-emerald-700">
          신청이 접수되었습니다!
        </p>
        <p className="mt-1 text-sm text-emerald-700/80">
          24시간 내 다프 담당자가 연락드릴게요.
        </p>
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
          if (!res.ok) setError("입력이 올바르지 않습니다.");
          else setDone(true);
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          이름 <span className="text-red-500">*</span>
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
            전화번호 <span className="text-red-500">*</span>
          </span>
          <input
            name="phone"
            required
            type="tel"
            placeholder="+84 ..."
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">이메일 (선택)</span>
          <input
            name="email"
            type="email"
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">희망 반</span>
        <select
          name="level"
          defaultValue={recommendedLevel ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        {recommendedLevel && (
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            테스트 결과로 추천된 반이 자동으로 선택되었어요. 변경 가능합니다.
          </p>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">메모 (선택)</span>
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
        {pending ? "보내는 중..." : "상담 신청 →"}
      </button>
    </form>
  );
}
