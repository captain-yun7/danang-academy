"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addStudentNote, deleteStudentNote } from "./actions";

const CATEGORIES = ["general", "pronunciation", "attendance", "progress", "behavior"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_EMOJI: Record<Category, string> = {
  general: "📝",
  pronunciation: "🎤",
  attendance: "📅",
  progress: "📈",
  behavior: "🤝",
};

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
  const t = useTranslations("admin.students.notes");
  const tCat = useTranslations("admin.students.notes.categories");
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
        setError(err instanceof Error ? err.message : "error");
      }
    });
  }

  function remove(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await deleteStudentNote({ id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      <h2 className="mb-4 text-base font-bold">{t("title", { count: notes.length })}</h2>

      <div className="mb-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-soft)] p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  active
                    ? CATEGORY_TONE[c]
                    : "border border-[var(--color-line)] text-[var(--color-muted)]"
                }`}
              >
                {CATEGORY_EMOJI[c]} {tCat(c)}
              </button>
            );
          })}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={t("placeholder")}
          className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-primary)]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">{content.length}/2000</span>
          <button
            type="button"
            disabled={pending || !content.trim()}
            onClick={submit}
            className="brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            {pending ? t("adding") : t("add")}
          </button>
        </div>
        {error && (
          <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const canDelete = n.author_id === currentUserId || isManagerPlus;
            const cat = n.category as Category;
            return (
              <li
                key={n.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_TONE[cat]}`}
                      >
                        {CATEGORY_EMOJI[cat]} {tCat(cat)}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {n.author_name ?? t("deletedAuthor")} · {n.created_at}
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
                      {t("deleteBtn")}
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
