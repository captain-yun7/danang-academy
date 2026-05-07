"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus, updateLeadNote } from "./actions";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const STATUS_OPTIONS = ["new", "contacted", "enrolled", "dropped"] as const;
const STATUS_TONE: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  enrolled: "bg-emerald-100 text-emerald-700",
  dropped: "bg-gray-200 text-gray-600",
};

export function LeadRow({
  lead,
  statusLabel,
  sourceLabel,
}: {
  lead: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    source_test_id: string | null;
    level: string | null;
    status: string;
    note: string | null;
    created_at: string;
  };
  statusLabel: Record<string, string>;
  sourceLabel: Record<string, string>;
}) {
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.note ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold">{lead.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}
            >
              {statusLabel[status]}
            </span>
            {lead.source && (
              <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-xs">
                {sourceLabel[lead.source] ?? lead.source}
              </span>
            )}
            {lead.level && (
              <span className="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs font-semibold">
                {LEVEL_LABEL[lead.level]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {lead.phone ?? "—"}
            {lead.email && ` · ${lead.email}`}
          </p>
          <p className="text-xs text-[var(--color-muted)]">{lead.created_at}</p>
        </div>

        <select
          disabled={pending}
          value={status}
          onChange={(e) => {
            const next = e.target.value as (typeof STATUS_OPTIONS)[number];
            setStatus(next);
            startTransition(async () => {
              try {
                await updateLeadStatus({ id: lead.id, status: next });
              } catch {
                setStatus(lead.status);
              }
            });
          }}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-bold focus:border-[var(--color-primary)]"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        {!editingNote ? (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="text-left text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            📝 {note || "메모 없음 — 추가하기"}
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              autoFocus
              placeholder="메모 (1000자 이내)"
              className="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await updateLeadNote({ id: lead.id, note });
                    setEditingNote(false);
                  } catch {
                    /* keep editing */
                  }
                });
              }}
              className="brand-gradient rounded-full px-3 py-1.5 text-xs font-bold text-white"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setNote(lead.note ?? "");
                setEditingNote(false);
              }}
              className="rounded-full border-2 border-[var(--color-line)] px-3 py-1.5 text-xs font-bold"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
