"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createAssignment, updateAssignment } from "./actions";

type Klass = { id: string; name: string };
type Student = { id: string; name: string; studentCode: string | null; className: string | null };
type TargetType = "all" | "class" | "students";

type Initial = {
  id: string;
  type: "pronunciation" | "writing";
  targetType: TargetType;
  classId: string | null;
  studentIds: string[];
  title: string;
  instructions: string | null;
  targetText: string | null;
  dueDate: string | null;
};

export function AssignmentForm({
  mode,
  classes,
  students,
  initial,
}: {
  mode: "create" | "edit";
  classes: Klass[];
  students: Student[];
  initial?: Initial;
}) {
  const t = useTranslations("admin.assignments.form");
  const tType = useTranslations("admin.assignments.types");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<"pronunciation" | "writing">(initial?.type ?? "pronunciation");
  const [targetType, setTargetType] = useState<TargetType>(initial?.targetType ?? "all");
  const [classId, setClassId] = useState(initial?.classId ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.studentIds ?? []));

  function toggle(id: string) {
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
          targetType,
          classId: targetType === "class" ? classId : "",
          studentIds: targetType === "students" ? Array.from(picked) : [],
          title: String(fd.get("title") ?? ""),
          instructions: String(fd.get("instructions") ?? ""),
          targetText: String(fd.get("targetText") ?? ""),
          dueDate: String(fd.get("dueDate") ?? ""),
        };
        if (targetType === "class" && !classId) {
          setError(t("errors.needClass"));
          return;
        }
        if (targetType === "students" && picked.size === 0) {
          setError(t("errors.needStudents"));
          return;
        }
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
      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-xs font-semibold">{t("type")}</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "pronunciation" | "writing")}
          disabled={mode === "edit"}
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-soft)]"
        >
          <option value="pronunciation">{tType("pronunciation")}</option>
          <option value="writing">{tType("writing")}</option>
        </select>
      </label>

      {/* 배정 대상 */}
      <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
        <legend className="px-2 text-xs font-semibold">{t("target")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "class", "students"] as const).map((mode2) => (
            <button
              key={mode2}
              type="button"
              onClick={() => {
                setTargetType(mode2);
                setSaved(false);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                targetType === mode2
                  ? "brand-gradient text-white"
                  : "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              {t(`targets.${mode2}`)}
            </button>
          ))}
        </div>

        {targetType === "class" && (
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSaved(false);
            }}
            className="mt-3 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] sm:max-w-sm"
          >
            <option value="">{t("selectClass")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {targetType === "students" && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] text-[var(--color-muted)]">
              {t("pickedCount", { count: picked.size })}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-line)]">
              {students.length === 0 ? (
                <p className="p-4 text-xs text-[var(--color-muted)]">{t("noStudents")}</p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {students.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--color-soft)]/50">
                        <input
                          type="checkbox"
                          checked={picked.has(s.id)}
                          onChange={() => toggle(s.id)}
                        />
                        {s.studentCode && (
                          <span className="rounded bg-[var(--color-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                            {s.studentCode}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{s.name}</span>
                        {s.className && (
                          <span className="ml-auto text-[11px] text-[var(--color-muted)]">
                            {s.className}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </fieldset>

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
