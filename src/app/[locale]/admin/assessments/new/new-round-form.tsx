"use client";

import { useState, useTransition } from "react";
import { createRound } from "../actions";

export function NewRoundForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setErr(null);
    if (!classId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr("반, 제목, 평가일을 모두 입력하세요.");
      return;
    }
    startTransition(async () => {
      try {
        await createRound({ classId, title: title.trim(), date });
      } catch (e) {
        // redirect()는 예외를 던지므로 NEXT_REDIRECT는 무시
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        setErr("회차 생성에 실패했습니다.");
      }
    });
  }

  if (classes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
        먼저 반을 생성하세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">반</span>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold">회차 제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 6월 4주차 주말평가"
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold">평가일</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="brand-gradient w-full rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "생성 중…" : "회차 생성"}
      </button>
    </div>
  );
}
