"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { markListened, type StudentAssignmentDetail } from "../../actions";

export function ListeningPlayer({ detail }: { detail: StudentAssignmentDetail }) {
  const t = useTranslations("studentPortal.listening");
  const [done, setDone] = useState(detail.submission?.status === "completed");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      {detail.target_text && (
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            {t("script")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-relaxed">
            {detail.target_text}
          </p>
          {detail.ttsUrl ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-[var(--color-muted)]">{t("audio")}</p>
              <audio controls src={detail.ttsUrl} className="w-full" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-muted)]">{t("audioPending")}</p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 text-center">
        {done ? (
          <p className="text-sm font-bold text-emerald-600">✓ {t("done")}</p>
        ) : (
          <>
            <p className="mb-4 text-sm font-semibold text-[var(--color-muted)]">{t("prompt")}</p>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await markListened(detail.id);
                  setDone(true);
                } catch {
                  setError(t("error"));
                } finally {
                  setPending(false);
                }
              }}
              className="brand-gradient rounded-full px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
            >
              {pending ? t("marking") : t("markDone")}
            </button>
          </>
        )}
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
