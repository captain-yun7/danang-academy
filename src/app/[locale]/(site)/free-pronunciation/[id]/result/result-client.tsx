"use client";

import useSWR from "swr";
import Link from "next/link";
import { getFreePronunciationResult, type FreePronunciationResult } from "../../actions";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문반",
  elementary: "초급반",
  intermediate: "중급반",
  advanced: "고급반",
};

export function ResultClient({ id }: { id: string }) {
  const { data, error } = useSWR<FreePronunciationResult | null>(
    `fpt:${id}`,
    () => getFreePronunciationResult(id),
    {
      refreshInterval: (latest) =>
        latest?.status === "completed" || latest?.status === "failed" ? 0 : 2500,
      revalidateOnFocus: false,
    }
  );

  if (error) {
    return (
      <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
        결과를 불러오는 중 오류가 발생했어요.
      </p>
    );
  }

  if (!data) {
    return (
      <p className="mt-6 text-sm text-[var(--color-muted)]">불러오는 중...</p>
    );
  }

  if (data.status === "pending" || data.status === "processing") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-4 text-sm font-semibold">AI가 발음을 분석하고 있어요...</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">보통 10~30초 걸립니다.</p>
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-700">
          죄송해요, 채점에 실패했습니다. 다시 시도해 주세요.
        </p>
        <Link
          href="/free-pronunciation"
          className="mt-4 inline-block text-xs font-bold text-red-700 underline"
        >
          다시 테스트 시작 →
        </Link>
      </div>
    );
  }

  const level = data.recommendedClassLevel
    ? (LEVEL_LABEL[data.recommendedClassLevel] ?? data.recommendedClassLevel)
    : "—";

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-soft)] to-white p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-deep)]">
          {data.visitorName}님의 발음 점수
        </p>
        <p className="mt-3 brand-gradient-text text-6xl font-black">
          {data.score ?? "—"}
          <span className="text-2xl text-[var(--color-muted)]"> / 100</span>
        </p>
        <p className="mt-3 text-sm">
          추천 반: <strong className="text-base">{level}</strong>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            👍 좋은 점
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {data.strengths || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
            🎯 개선점
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {data.improvements || "—"}
          </p>
        </div>
      </div>

      {data.transcript && (
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            📝 인식된 발음
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            <span className="text-[var(--color-muted)]">목표:</span>{" "}
            {data.targetSentence}
            <br />
            <span className="text-[var(--color-muted)]">인식:</span>{" "}
            {data.transcript}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/consult?source=pronunciation_test&testId=${data.id}&level=${data.recommendedClassLevel ?? ""}`}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
        >
          이 반으로 상담 신청 →
        </Link>
        <Link
          href="/free-pronunciation"
          className="rounded-full border-2 border-[var(--color-line)] px-5 py-3 text-sm font-bold hover:border-[var(--color-ink)]"
        >
          다시 테스트
        </Link>
      </div>
    </div>
  );
}
