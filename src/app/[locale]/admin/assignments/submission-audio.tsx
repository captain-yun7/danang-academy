"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { getSubmissionAudioUrl, getStepSubmissionAudioUrl } from "./actions";

export function SubmissionAudio({
  submissionId,
  kind = "aggregate",
}: {
  submissionId: string;
  kind?: "aggregate" | "step";
}) {
  const t = useTranslations("admin.assignments.detail");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (url) {
    return <audio controls src={url} className="h-8 w-48" />;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const u =
            kind === "step"
              ? await getStepSubmissionAudioUrl(submissionId)
              : await getSubmissionAudioUrl(submissionId);
          if (u) setUrl(u);
        })
      }
      className="rounded-full border-2 border-[var(--color-line)] px-3 py-1 text-xs font-bold hover:border-[var(--color-primary)] disabled:opacity-50"
    >
      {pending ? t("loadingAudio") : t("playAudio")}
    </button>
  );
}
