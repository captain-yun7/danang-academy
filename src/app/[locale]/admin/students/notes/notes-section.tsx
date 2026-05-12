"use client";

import { useState, useTransition } from "react";
import { addStudentNote, deleteStudentNote } from "./actions";

const CATEGORIES = [
  { value: "general", label: "일반", emoji: "📝" },
  { value: "pronunciation", label: "발음", emoji: "🎤" },
  { value: "attendance", label: "출결", emoji: "📅" },
  { value: "progress", label: "진도", emoji: "📈" },
  { value: "behavior", label: "태도", emoji: "🤝" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const CATEGORY_EMOJI = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.emoji]));

const CATEGORY_TONE: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  pronunciation: "bg-purple-100 text-purple-700",
  attendance: "bg-amber-100 text-amber-700",
  progress: "bg-emerald-100 text-emerald-700",
  behavior: "bg-blue-100 text-blue-700",
};

export type StudentNote = {
  id: string;
  content: string;
  category: string;
  author_name: string | null;
  author_id: string | null;
  created_at: string;
};

export function NotesSection({
  studentId,
  notes,
  currentUserId,
  currentRole,
}: {
  studentId: string;
  notes: StudentNote[];
  currentUserId: string;
  currentRole: string;
}) {
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [error, setError] = useState<string | null>(null);
  const isManagerPlus = ["super_admin", "owner", "manager"].includes(currentRole);

  function submit() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addStudentNote({ studentId, content: content.trim(), category });
        setContent("");
        setCategory("general");
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("이 메모를 삭제할까요?")) return;
    startTransition(async () => {
      try {
        await deleteStudentNote({ id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류");
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      <h2 className="mb-4 text-base font-bold">강사 메모 ({notes.length})</h2>

      <div className="mb-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-soft)] p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  active
                    ? CATEGORY_TONE[c.value]
                    : "border border-[var(--color-line)] text-[var(--color-muted)]"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="예: 받침 발음 약함, 받침 ㄴ/ㅁ/ㅇ 보충 필요"
          className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-primary)]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">
            {content.length}/2000
          </span>
          <button
            type="button"
            disabled={pending || !content.trim()}
            onClick={submit}
            className="brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "저장 중..." : "+ 메모 추가"}
          </button>
        </div>
        {error && (
          <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          아직 메모가 없어요. 발음 약점, 결석 사유, 진도 등 강사가 알아야 할 것을 남겨주세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const canDelete = n.author_id === currentUserId || isManagerPlus;
            return (
              <li
                key={n.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_TONE[n.category]}`}
                      >
                        {CATEGORY_EMOJI[n.category]} {CATEGORY_LABEL[n.category]}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {n.author_name ?? "(삭제됨)"} · {n.created_at}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(n.id)}
                      className="shrink-0 text-[10px] text-[var(--color-muted)] hover:text-red-600"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
