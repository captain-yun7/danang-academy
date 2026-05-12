"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createStudent, updateStudent, deleteStudent } from "./actions";

const LEVEL_KEYS = ["", "beginner", "elementary", "intermediate", "advanced"] as const;
const LANG_KEYS = ["vi", "en", "other"] as const;
const STATUS_KEYS = ["active", "paused", "graduated", "dropped"] as const;

type Klass = { id: string; name: string; level: string };

type Initial = {
  id: string;
  name: string;
  phone: string | null;
  nativeLanguage: string;
  koreanLevel: string | null;
  classId: string | null;
  parentContact: string | null;
  enrolledAt: string | null;
  status: string;
};

export function StudentForm({
  mode,
  classes,
  initial,
}: {
  mode: "create" | "edit";
  classes: Klass[];
  initial?: Initial;
}) {
  const t = useTranslations("admin.students.form");
  const tLevel = useTranslations("admin.students.level");
  const tLang = useTranslations("admin.students.languages");
  const tStatus = useTranslations("admin.students.status");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const payload = {
          name: String(fd.get("name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          nativeLanguage: fd.get("nativeLanguage") as "vi" | "en" | "other",
          koreanLevel: String(fd.get("koreanLevel") ?? "") as
            | "" | "beginner" | "elementary" | "intermediate" | "advanced",
          classId: String(fd.get("classId") ?? ""),
          parentContact: String(fd.get("parentContact") ?? ""),
          enrolledAt: String(fd.get("enrolledAt") ?? ""),
          status: (fd.get("status") as string) as
            | "active" | "paused" | "graduated" | "dropped",
        };
        startTransition(async () => {
          try {
            if (mode === "create") await createStudent(payload);
            else if (initial) await updateStudent({ ...payload, id: initial.id });
          } catch (err) {
            setError(err instanceof Error ? err.message : "오류");
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
          defaultValue={initial?.name ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("phone")}</span>
          <input
            name="phone"
            type="tel"
            placeholder={t("phonePlaceholder")}
            defaultValue={initial?.phone ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("nativeLanguage")}</span>
          <select
            name="nativeLanguage"
            defaultValue={initial?.nativeLanguage ?? "vi"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {LANG_KEYS.map((k) => (
              <option key={k} value={k}>
                {tLang(k)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("koreanLevel")}</span>
          <select
            name="koreanLevel"
            defaultValue={initial?.koreanLevel ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {LEVEL_KEYS.map((k) => (
              <option key={k} value={k}>
                {k === "" ? "—" : tLevel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("class")}</span>
          <select
            name="classId"
            defaultValue={initial?.classId ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("parentContact")}</span>
        <input
          name="parentContact"
          maxLength={120}
          placeholder={t("parentPlaceholder")}
          defaultValue={initial?.parentContact ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("enrolledAt")}</span>
          <input
            name="enrolledAt"
            type="date"
            defaultValue={initial?.enrolledAt ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">{t("status")}</span>
          <select
            name="status"
            defaultValue={initial?.status ?? "active"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          >
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {tStatus(k)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
        >
          {pending
            ? mode === "create"
              ? t("creating")
              : t("saving")
            : mode === "create"
              ? t("createBtn")
              : t("save")}
        </button>
        {mode === "edit" && initial && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(t("deleteConfirm", { name: initial.name }))) return;
              startTransition(async () => {
                try {
                  await deleteStudent(initial.id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "오류");
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
