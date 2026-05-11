"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { getPlacementResult, type PlacementResult } from "../../actions";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문반",
  elementary: "초급반",
  intermediate: "중급반",
  advanced: "고급반",
};

const LEVEL_DESC: Record<string, string> = {
  beginner: "한글과 기본 인사부터 차근차근 시작합니다.",
  elementary: "자기소개와 일상 문장 중심으로 배워요.",
  intermediate: "다양한 주제로 자유롭게 대화 연습합니다.",
  advanced: "뉴스·문화·TOPIK 대비까지 심화 학습합니다.",
};

export function ResultClient({ id }: { id: string }) {
  const { data, error } = useSWR<PlacementResult | null>(
    `pt:${id}:result`,
    () => getPlacementResult(id),
    { revalidateOnFocus: false }
  );

  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
        결과를 불러오는 중 오류가 발생했어요.
      </p>
    );
  }
  if (!data) return <p className="mt-6 text-sm text-[var(--color-muted)]">불러오는 중...</p>;

  if (data.status !== "completed") {
    return (
      <Link
        href={`/placement/${id}/wait`}
        className="mt-6 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
      >
        아직 채점 중이에요. 대기 화면으로 →
      </Link>
    );
  }

  const level = data.recommendedLevel ?? "beginner";
  const consultHref = `/consult?source=placement_test&testId=${data.id}&level=${level}`;

  function copyLink() {
    if (typeof window === "undefined") return;
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-soft)] to-white p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-deep)]">
          {data.visitorName}님의 추천 반
        </p>
        <p className="mt-3 brand-gradient-text text-5xl font-black sm:text-6xl">
          {LEVEL_LABEL[level]}
        </p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {LEVEL_DESC[level]}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            객관식
          </p>
          <p className="mt-2 text-3xl font-black">
            {data.mcqScore}
            <span className="text-base text-[var(--color-muted)]"> / 7</span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            발음
          </p>
          <p className="mt-2 text-3xl font-black">
            {data.pronunciation?.score ?? "—"}
            <span className="text-base text-[var(--color-muted)]"> / 100</span>
          </p>
        </div>
      </div>

      {data.pronunciation && (data.pronunciation.strengths || data.pronunciation.improvements) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              👍 좋은 점
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {data.pronunciation.strengths || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
              🎯 개선점
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {data.pronunciation.improvements || "—"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={consultHref}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
        >
          이 반으로 상담 신청 →
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-full border-2 border-[var(--color-line)] px-5 py-3 text-sm font-bold hover:border-[var(--color-ink)]"
        >
          {copied ? "✅ 복사됨!" : "🔗 링크 복사"}
        </button>
        <Link
          href="/placement"
          className="rounded-full border-2 border-[var(--color-line)] px-5 py-3 text-sm font-bold hover:border-[var(--color-ink)]"
        >
          다시 테스트
        </Link>
      </div>
    </div>
  );
}
