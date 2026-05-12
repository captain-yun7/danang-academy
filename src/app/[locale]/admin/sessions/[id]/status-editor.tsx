"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateSessionStatus, updateSessionTopic } from "../actions";

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "cancelled", "rescheduled"] as const;
type StatusValue = (typeof STATUS_OPTIONS)[number];

export function SessionStatusEditor({
  sessionId,
  status: initialStatus,
  notes: initialNotes,
  topic: initialTopic,
}: {
  sessionId: string;
  status: string;
  notes: string | null;
  topic: string | null;
}) {
  const t = useTranslations("admin.sessions");
  const tStatus = useTranslations("admin.sessions.statusLabel");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<StatusValue>(initialStatus as StatusValue);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("topicLabel")}</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onBlur={() => {
            if (topic === (initialTopic ?? "")) return;
            startTransition(async () => {
              try {
                await updateSessionTopic({ sessionId, topic });
              } catch (err) {
                console.error(err);
              }
            });
          }}
          maxLength={200}
          placeholder={t("topicPlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("statusFieldLabel")}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusValue)}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {tStatus(o)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("notesLabel")}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                await updateSessionStatus({ sessionId, status, notes });
                setSavedMsg(t("saved"));
                setTimeout(() => setSavedMsg(null), 2000);
              } catch (err) {
                setSavedMsg(err instanceof Error ? err.message : "error");
              }
            });
          }}
          className="brand-gradient rounded-full px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : t("saveBtn")}
        </button>
        {savedMsg && (
          <span className="text-xs font-semibold text-emerald-600">{savedMsg}</span>
        )}
      </div>
    </div>
  );
}
