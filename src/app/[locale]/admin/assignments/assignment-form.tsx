"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createAssignment, updateAssignment } from "./actions";

type Klass = { id: string; name: string };

type Initial = {
  id: string;
  type: "pronunciation" | "writing";
  classId: string | null;
  title: string;
  instructions: string | null;
  targetText: string | null;
  dueDate: string | null;
};

export function AssignmentForm({
  mode,
  classes,
  initial,
}: {
  mode: "create" | "edit";
  classes: Klass[];
  initial?: Initial;
}) {
  const t = useTranslations("admin.assignments.form");
  const tType = useTranslations("admin.assignments.types");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<"pronunciation" | "writing">(initial?.type ?? "pronunciation");

  return (
    <form
      onChange={() => saved && setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const fd = new FormData(e.currentTarget);
        const payload = {
          type,
          classId: String(fd.get("classId") ?? ""),
          title: String(fd.get("title") ?? ""),
          instructions: String(fd.get("instructions") ?? ""),
          targetText: String(fd.get("targetText") ?? ""),
          dueDate: String(fd.get("dueDate") ?? ""),
        };
        startTransition(async () => {
          try {
            if (mode === "create") await createAssignment(payload);
            else if (initial) {
              await updateAssignment({ ...payload, id: initial.id });
              setSaved(true);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "error";
            setError(msg === "invalid_input" ? t("errors.invalidInput") : t("errors.generic"));
          }
        });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("type")}</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "pronunciation" | "writing")}
            disabled={mode === "edit"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-soft)]"
          >
            <option value="pronunciation">{tType("pronunciation")}</option>
            <option value="writing">{tType("writing")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("class")}</span>
          <select
            name="classId"
            defaultValue={initial?.classId ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">{t("allClasses")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {t("titleField")} <span className="text-red-500">*</span>
        </span>
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={initial?.title ?? ""}
          placeholder={t("titlePlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {type === "pronunciation" ? t("targetPronunciation") : t("targetWriting")}{" "}
          <span className="text-red-500">*</span>
        </span>
        <textarea
          name="targetText"
          required
          maxLength={2000}
          rows={type === "pronunciation" ? 5 : 3}
          defaultValue={initial?.targetText ?? ""}
          placeholder={
            type === "pronunciation" ? t("targetPronunciationPlaceholder") : t("targetWritingPlaceholder")
          }
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        {type === "pronunciation" && (
          <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{t("ttsHint")}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("instructions")}</span>
        <textarea
          name="instructions"
          maxLength={2000}
          rows={2}
          defaultValue={initial?.instructions ?? ""}
          placeholder={t("instructionsPlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("dueDate")}</span>
        <input
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] sm:w-48"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          <span aria-hidden>✓</span>
          {t("saved")}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : mode === "create" ? t("createBtn") : t("save")}
        </button>
      </div>
    </form>
  );
}
