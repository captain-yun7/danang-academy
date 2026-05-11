"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitMcq, type McqQuestion } from "../../actions";

export function McqQuiz({
  placementId,
  questions,
}: {
  placementId: string;
  questions: McqQuestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const total = questions.length;
  const current = questions[idx];
  const progress = Math.round(((idx + 1) / total) * 100);

  if (!current) return null;

  function pick(choiceIndex: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: choiceIndex }));
  }

  function next() {
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      submitAll();
    }
  }

  function submitAll() {
    setError(null);
    const payload = questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({ questionId: q.id, choiceIndex: answers[q.id] }));
    if (payload.length !== total) {
      setError("모든 문항에 답해주세요.");
      return;
    }
    startTransition(async () => {
      const res = await submitMcq({ id: placementId, answers: payload });
      if (!res.ok) {
        setError("채점 중 오류가 발생했어요.");
        return;
      }
      router.push(`/placement/${placementId}/speak`);
    });
  }

  const selected = answers[current.id];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--color-muted)]">
          <span>문항 {idx + 1} / {total}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
          <div
            className="brand-gradient h-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <p className="text-base font-bold leading-relaxed sm:text-lg">
          {current.question_ko}
        </p>
        {current.question_vi && current.question_vi !== current.question_ko && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {current.question_vi}
          </p>
        )}

        <div className="mt-5 grid gap-2">
          {current.choices.map((c, ci) => {
            const isSelected = selected === ci;
            return (
              <button
                key={ci}
                type="button"
                onClick={() => pick(ci)}
                className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-soft)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    isSelected
                      ? "brand-gradient text-white"
                      : "bg-[var(--color-soft)] text-[var(--color-ink)]"
                  }`}
                >
                  {String.fromCharCode(65 + ci)}
                </span>
                <span className="font-medium">{c.ko}</span>
                {c.vi && c.vi !== c.ko && (
                  <span className="text-xs text-[var(--color-muted)]">
                    ({c.vi})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="rounded-full border-2 border-[var(--color-line)] px-5 py-2.5 text-sm font-bold disabled:opacity-40"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={next}
          disabled={selected === undefined || pending}
          className="brand-gradient rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
        >
          {idx === total - 1
            ? pending
              ? "채점 중..."
              : "제출 → 발음 단계로"
            : "다음 →"}
        </button>
      </div>
    </div>
  );
}
