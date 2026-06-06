"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { gradeWriting } from "./actions";

export function GradeWriting({
  submissionId,
  initialScore,
  initialComment,
  graded,
}: {
  submissionId: string;
  initialScore: number | null;
  initialComment: string | null;
  graded: boolean;
}) {
  const t = useTranslations("admin.assignments.detail");
  const [pending, startTransition] = useTransition();
  const [score, setScore] = useState(initialScore?.toString() ?? "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          try {
            await gradeWriting({ submissionId, score: Number(score), comment });
            setSaved(true);
          } catch {
            setError(t("gradeError"));
          }
        });
      }}
      className="mt-2 grid gap-2 sm:grid-cols-[80px_1fr_auto] sm:items-start"
    >
      <input
        type="number"
        min={0}
        max={100}
        required
        value={score}
        onChange={(e) => {
          setScore(e.target.value);
          setSaved(false);
        }}
        placeholder={t("scorePlaceholder")}
        className="rounded-lg border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      <input
        type="text"
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setSaved(false);
        }}
        maxLength={2000}
        placeholder={t("commentPlaceholder")}
        className="rounded-lg border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? t("grading") : graded ? t("regrade") : t("grade")}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-600">✓</span>}
        {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
      </div>
    </form>
  );
}
