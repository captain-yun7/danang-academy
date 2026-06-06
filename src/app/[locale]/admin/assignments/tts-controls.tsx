"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { regenerateTts, deleteAssignment } from "./actions";

export function TtsControls({
  assignmentId,
  ttsStatus,
  ttsUrl,
}: {
  assignmentId: string;
  ttsStatus: string | null;
  ttsUrl: string | null;
}) {
  const t = useTranslations("admin.assignments.detail");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("ttsTitle")}
      </p>
      <p className="mt-2 text-xs">
        {ttsStatus === "ready" ? (
          <span className="font-semibold text-emerald-600">● {t("ttsReady")}</span>
        ) : ttsStatus === "pending" ? (
          <span className="font-semibold text-amber-600">● {t("ttsGenerating")}</span>
        ) : (
          <span className="font-semibold text-red-600">● {t("ttsFailed")}</span>
        )}
      </p>
      {ttsUrl && <audio controls src={ttsUrl} className="mt-3 h-9 w-full" />}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => regenerateTts(assignmentId))}
        className="mt-3 rounded-full border-2 border-[var(--color-line)] px-4 py-1.5 text-xs font-bold hover:border-[var(--color-primary)] disabled:opacity-50"
      >
        {pending ? t("ttsRegenerating") : t("ttsRegenerate")}
      </button>
    </div>
  );
}

export function DeleteAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations("admin.assignments.detail");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("deleteConfirm"))) return;
        startTransition(() => deleteAssignment(assignmentId));
      }}
      className="rounded-full border-2 border-red-300 px-5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {t("deleteBtn")}
    </button>
  );
}
