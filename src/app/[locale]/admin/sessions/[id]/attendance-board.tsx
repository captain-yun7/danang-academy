"use client";

import { useState, useTransition } from "react";
import { markAttendance } from "../actions";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_BUTTONS: { value: Status; label: string; cls: string }[] = [
  { value: "present", label: "출석", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "late", label: "지각", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "absent", label: "결석", cls: "bg-red-100 text-red-700 border-red-300" },
  { value: "excused", label: "사유", cls: "bg-blue-100 text-blue-700 border-blue-300" },
];

const ACTIVE_BORDER = "ring-2 ring-offset-1 ring-current";

type StudentRow = {
  id: string;
  name: string;
  att_status: string | null;
  att_note: string | null;
  qr_scan_id: string | null;
};

export function AttendanceBoard({
  sessionId,
  roster,
}: {
  sessionId: string;
  roster: StudentRow[];
}) {
  if (roster.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        이 반에 배정된 학생이 없어요.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {roster.map((s) => (
        <AttendanceRow key={s.id} sessionId={sessionId} student={s} />
      ))}
    </ul>
  );
}

function AttendanceRow({
  sessionId,
  student,
}: {
  sessionId: string;
  student: StudentRow;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status | null>(
    (student.att_status as Status | null) ?? null
  );
  const [note, setNote] = useState(student.att_note ?? "");
  const [showNote, setShowNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  function set(next: Status) {
    setStatus(next);
    startTransition(async () => {
      try {
        await markAttendance({ sessionId, studentId: student.id, status: next, note });
      } catch (err) {
        console.error(err);
      }
    });
  }

  function saveNote() {
    if (!status) return;
    startTransition(async () => {
      try {
        await markAttendance({ sessionId, studentId: student.id, status, note });
        setSavedNote(true);
        setTimeout(() => setSavedNote(false), 1500);
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{student.name}</p>
          {student.qr_scan_id && (
            <p className="text-[10px] text-emerald-600">📱 QR 자동 기록</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_BUTTONS.map((b) => {
            const active = status === b.value;
            return (
              <button
                key={b.value}
                type="button"
                disabled={pending}
                onClick={() => set(b.value)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${b.cls} ${
                  active ? ACTIVE_BORDER : "opacity-60 hover:opacity-100"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          📝
        </button>
      </div>
      {showNote && (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택)"
            maxLength={500}
            className="flex-1 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={pending || !status}
            onClick={saveNote}
            className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {savedNote ? "✓" : "저장"}
          </button>
        </div>
      )}
    </li>
  );
}
