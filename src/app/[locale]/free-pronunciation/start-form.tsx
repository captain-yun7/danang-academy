"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startFreePronunciationTest } from "./actions";

const LEVELS = [
  { value: "beginner", label: "입문 (한글을 막 배웠어요)" },
  { value: "elementary", label: "초급 (자기소개 정도)" },
  { value: "intermediate", label: "중급 (일상 대화 가능)" },
  { value: "advanced", label: "고급 (뉴스/책을 읽어요)" },
] as const;

const LANGS = [
  { value: "vi", label: "Tiếng Việt (베트남어)" },
  { value: "en", label: "English" },
  { value: "other", label: "기타" },
] as const;

export function StartForm() {
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
          const res = await startFreePronunciationTest({
            visitorName: String(fd.get("name") ?? ""),
            nativeLanguage: fd.get("nativeLanguage") as "vi" | "en" | "other",
            koreanLevel: fd.get("koreanLevel") as
              | "beginner"
              | "elementary"
              | "intermediate"
              | "advanced",
          });
          if (!res.ok) {
            setError(
              res.error === "rate_limited"
                ? "오늘 5회 테스트를 모두 사용하셨습니다. 내일 다시 시도해 주세요."
                : res.error === "no_sentence"
                  ? "해당 레벨의 문장이 아직 준비되지 않았어요."
                  : "입력이 올바르지 않습니다."
            );
            return;
          }
          router.push(`/free-pronunciation/${res.id}/record`);
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          이름/닉네임 <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={60}
          placeholder="홍길동"
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">모국어</span>
        <select
          name="nativeLanguage"
          defaultValue="vi"
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">한국어 수준</span>
        <select
          name="koreanLevel"
          defaultValue="elementary"
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
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
        {pending ? "준비 중..." : "테스트 시작 →"}
      </button>
    </form>
  );
}
