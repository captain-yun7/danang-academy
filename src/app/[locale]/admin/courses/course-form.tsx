"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createCourse, updateCourse, deleteCourse } from "./actions";

type Initial = {
  id?: string;
  slug?: string;
  titleKo?: string;
  titleVi?: string;
  levelLabelKo?: string;
  levelLabelVi?: string;
  descKo?: string;
  descVi?: string;
  rating?: number;
  sessions?: number;
  sortOrder?: number;
  active?: boolean;
};

export function CourseForm({ initial }: { initial?: Initial }) {
  const t = useTranslations("admin.courses.form");
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [titleKo, setTitleKo] = useState(initial?.titleKo ?? "");
  const [titleVi, setTitleVi] = useState(initial?.titleVi ?? "");
  const [levelLabelKo, setLevelLabelKo] = useState(initial?.levelLabelKo ?? "");
  const [levelLabelVi, setLevelLabelVi] = useState(initial?.levelLabelVi ?? "");
  const [descKo, setDescKo] = useState(initial?.descKo ?? "");
  const [descVi, setDescVi] = useState(initial?.descVi ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 4.7);
  const [sessions, setSessions] = useState(initial?.sessions ?? 30);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 99);
  const [active, setActive] = useState(initial?.active ?? true);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const payload = {
      slug: slug.trim(),
      titleKo: titleKo.trim(),
      titleVi: titleVi.trim(),
      levelLabelKo: levelLabelKo.trim(),
      levelLabelVi: levelLabelVi.trim(),
      descKo: descKo.trim(),
      descVi: descVi.trim(),
      rating,
      sessions,
      sortOrder,
      active,
    };
    startTransition(async () => {
      try {
        if (isEdit && initial?.id) {
          await updateCourse({ id: initial.id, ...payload });
          router.refresh();
        } else {
          await createCourse(payload);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        setError(
          msg === "slug_taken"
            ? t("errors.slugTaken")
            : msg === "invalid_input"
              ? t("errors.invalidInput")
              : t("errors.generic")
        );
      }
    });
  }

  function onDelete() {
    if (!initial?.id) return;
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      try {
        await deleteCourse(initial.id!);
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-5"
    >
      <Field label={t("slug")} hint={t("slugHint")}>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="pronunciation"
          className="input"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("titleKo")}>
          <input value={titleKo} onChange={(e) => setTitleKo(e.target.value)} className="input" />
        </Field>
        <Field label={t("titleVi")}>
          <input value={titleVi} onChange={(e) => setTitleVi(e.target.value)} className="input" />
        </Field>
        <Field label={t("levelLabelKo")}>
          <input value={levelLabelKo} onChange={(e) => setLevelLabelKo(e.target.value)} className="input" />
        </Field>
        <Field label={t("levelLabelVi")}>
          <input value={levelLabelVi} onChange={(e) => setLevelLabelVi(e.target.value)} className="input" />
        </Field>
      </div>

      <Field label={t("descKo")}>
        <textarea
          value={descKo}
          onChange={(e) => setDescKo(e.target.value)}
          rows={2}
          className="input"
        />
      </Field>
      <Field label={t("descVi")}>
        <textarea
          value={descVi}
          onChange={(e) => setDescVi(e.target.value)}
          rows={2}
          className="input"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t("rating")} hint={t("ratingHint")}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label={t("sessions")} hint={t("sessionsHint")}>
          <input
            type="number"
            min="1"
            max="999"
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label={t("sortOrder")} hint={t("sortOrderHint")}>
          <input
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="input"
          />
        </Field>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        {t("active")}
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("saving") : isEdit ? t("save") : t("create")}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-full border-2 border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            {t("delete")}
          </button>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--color-line);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: var(--color-primary); }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{hint}</span>
      )}
    </label>
  );
}
