"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClass, updateClass, deleteClass } from "./actions";

const LEVEL_KEYS = ["beginner", "elementary", "intermediate", "advanced"] as const;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

type Teacher = { id: string; name: string };

type RecurringPattern = {
  days?: string[];
  start_time?: string;
  end_time?: string;
};

type Initial = {
  id: string;
  name: string;
  level: string;
  teacherId: string | null;
  schedule: string | null;
  capacity: number;
  recurringPattern?: RecurringPattern | null;
};

export function ClassForm({
  mode,
  teachers,
  initial,
}: {
  mode: "create" | "edit";
  teachers: Teacher[];
  initial?: Initial;
}) {
  const t = useTranslations("admin.classes.form");
  const tLevel = useTranslations("admin.classes.level");
  const tDay = useTranslations("admin.classes.days");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initialDays = new Set(initial?.recurringPattern?.days ?? []);
  const [days, setDays] = useState<Set<string>>(initialDays);

  return (
    <form
      onChange={() => saved && setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const fd = new FormData(e.currentTarget);
        const payload = {
          name: String(fd.get("name") ?? ""),
          level: fd.get("level") as
            | "beginner" | "elementary" | "intermediate" | "advanced",
          teacherId: String(fd.get("teacherId") ?? ""),
          schedule: String(fd.get("schedule") ?? ""),
          capacity: Number(fd.get("capacity") ?? 10),
          recurringPattern: {
            days: Array.from(days) as DayKey[],
            start_time: String(fd.get("startTime") ?? ""),
            end_time: String(fd.get("endTime") ?? ""),
          },
        };
        startTransition(async () => {
          try {
            if (mode === "create") await createClass(payload);
            else if (initial) {
              await updateClass({ ...payload, id: initial.id });
              setSaved(true);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "error");
          }
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {t("name")} <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={60}
          placeholder={t("namePlaceholder")}
          defaultValue={initial?.name ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("level")}</span>
          <select
            name="level"
            required
            defaultValue={initial?.level ?? "beginner"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {LEVEL_KEYS.map((k) => (
              <option key={k} value={k}>
                {tLevel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("teacher")}</span>
          <select
            name="teacherId"
            defaultValue={initial?.teacherId ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">{t("teacherNone")}</option>
            {teachers.map((te) => (
              <option key={te.id} value={te.id}>
                {te.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
        <legend className="px-2 text-xs font-semibold">{t("recurringTitle")}</legend>
        <p className="mb-3 text-[11px] text-[var(--color-muted)]">{t("recurringDesc")}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {DAY_KEYS.map((d) => {
            const active = days.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDays((prev) => {
                    const next = new Set(prev);
                    if (next.has(d)) next.delete(d);
                    else next.add(d);
                    return next;
                  });
                }}
                className={`h-9 w-9 rounded-full text-sm font-bold transition ${
                  active
                    ? "brand-gradient text-white"
                    : "border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-ink)]"
                }`}
              >
                {tDay(d)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t("startTime")}</span>
            <input
              name="startTime"
              type="time"
              defaultValue={initial?.recurringPattern?.start_time ?? ""}
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t("endTime")}</span>
            <input
              name="endTime"
              type="time"
              defaultValue={initial?.recurringPattern?.end_time ?? ""}
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)]"
            />
          </label>
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("schedule")}</span>
        <input
          name="schedule"
          maxLength={120}
          placeholder={t("schedulePlaceholder")}
          defaultValue={initial?.schedule ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("capacity")}</span>
        <input
          name="capacity"
          type="number"
          min={1}
          max={100}
          defaultValue={initial?.capacity ?? 10}
          className="w-32 rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {saved && (
        <p className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          <span aria-hidden>✓</span>
          {t("saved")}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : mode === "create" ? t("createBtn") : t("saveBtn")}
        </button>
        {mode === "edit" && initial && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(t("deleteConfirm", { name: initial.name }))) return;
              startTransition(async () => {
                try {
                  await deleteClass(initial.id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "error");
                }
              });
            }}
            className="rounded-full border-2 border-red-300 px-5 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            {t("deleteBtn")}
          </button>
        )}
      </div>
    </form>
  );
}
