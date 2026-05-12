"use client";

import { useState, useTransition } from "react";
import { createStudent, updateStudent, deleteStudent } from "./actions";

const LEVELS = [
  { value: "", label: "—" },
  { value: "beginner", label: "입문" },
  { value: "elementary", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
] as const;

const LANGS = [
  { value: "vi", label: "Tiếng Việt (베트남어)" },
  { value: "en", label: "English" },
  { value: "other", label: "기타" },
] as const;

const STATUSES = [
  { value: "active", label: "수강중" },
  { value: "paused", label: "휴학" },
  { value: "graduated", label: "수료" },
  { value: "dropped", label: "이탈" },
] as const;

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
            | ""
            | "beginner"
            | "elementary"
            | "intermediate"
            | "advanced",
          classId: String(fd.get("classId") ?? ""),
          parentContact: String(fd.get("parentContact") ?? ""),
          enrolledAt: String(fd.get("enrolledAt") ?? ""),
          status: (fd.get("status") as string) as
            | "active" | "paused" | "graduated" | "dropped",
        };
        startTransition(async () => {
          try {
            if (mode === "create") {
              await createStudent(payload);
            } else if (initial) {
              await updateStudent({ ...payload, id: initial.id });
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
          이름 <span className="text-red-500">*</span>
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
          <span className="mb-1 block text-xs font-semibold">전화번호</span>
          <input
            name="phone"
            type="tel"
            placeholder="+84 ..."
            defaultValue={initial?.phone ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">모국어</span>
          <select
            name="nativeLanguage"
            defaultValue={initial?.nativeLanguage ?? "vi"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">한국어 레벨</span>
          <select
            name="koreanLevel"
            defaultValue={initial?.koreanLevel ?? ""}
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
          <span className="mb-1 block text-xs font-semibold">반</span>
          <select
            name="classId"
            defaultValue={initial?.classId ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">미배정</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">부모 연락처</span>
        <input
          name="parentContact"
          maxLength={120}
          placeholder="(선택)"
          defaultValue={initial?.parentContact ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">등록일</span>
          <input
            name="enrolledAt"
            type="date"
            defaultValue={initial?.enrolledAt ?? ""}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">상태</span>
          <select
            name="status"
            defaultValue={initial?.status ?? "active"}
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
              ? "등록 중..."
              : "저장 중..."
            : mode === "create"
              ? "등록 →"
              : "저장"}
        </button>
        {mode === "edit" && initial && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (!confirm(`${initial.name} 학생을 삭제할까요? 출석 이력도 함께 사라집니다.`))
                return;
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
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
