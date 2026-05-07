"use client";

import { useState, useTransition } from "react";
import { createClass, updateClass, deleteClass } from "./actions";

const LEVELS = [
  { value: "beginner", label: "입문반" },
  { value: "elementary", label: "초급반" },
  { value: "intermediate", label: "중급반" },
  { value: "advanced", label: "고급반" },
] as const;

type Teacher = { id: string; name: string };

type Initial = {
  id: string;
  name: string;
  level: string;
  teacherId: string | null;
  schedule: string | null;
  capacity: number;
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
          level: fd.get("level") as
            | "beginner"
            | "elementary"
            | "intermediate"
            | "advanced",
          teacherId: String(fd.get("teacherId") ?? ""),
          schedule: String(fd.get("schedule") ?? ""),
          capacity: Number(fd.get("capacity") ?? 10),
        };
        startTransition(async () => {
          try {
            if (mode === "create") {
              await createClass(payload);
            } else if (initial) {
              await updateClass({ ...payload, id: initial.id });
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "오류");
          }
        });
      }}
      className="grid gap-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          반 이름 <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={60}
          placeholder="예: 중급반 A"
          defaultValue={initial?.name ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">레벨</span>
          <select
            name="level"
            required
            defaultValue={initial?.level ?? "beginner"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">담당 강사</span>
          <select
            name="teacherId"
            defaultValue={initial?.teacherId ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">미배정</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">시간표</span>
        <input
          name="schedule"
          maxLength={120}
          placeholder="예: 월수금 19:00–21:00"
          defaultValue={initial?.schedule ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">정원</span>
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

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "저장 중..." : mode === "create" ? "개설 →" : "저장"}
        </button>
        {mode === "edit" && initial && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`${initial.name} 반을 삭제할까요? 이 반에 배정된 학생은 미배정으로 바뀝니다.`))
                return;
              startTransition(async () => {
                try {
                  await deleteClass(initial.id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "오류");
                }
              });
            }}
            className="rounded-full border-2 border-red-300 px-5 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
