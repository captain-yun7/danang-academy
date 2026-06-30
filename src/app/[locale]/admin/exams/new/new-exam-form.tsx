"use client";

import { useState, useTransition } from "react";
import { createExam } from "../actions";

export function NewExamForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cls =
    "mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

  function submit() {
    setErr(null);
    if (!classId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr("반, 제목, 평가일을 모두 입력하세요.");
      return;
    }
    startTransition(async () => {
      try {
        await createExam({ classId, title: title.trim(), date });
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        setErr("시험 생성에 실패했습니다.");
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
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={cls}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">시험 제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 6월 5주차 종합 복습 시험"
          className={cls}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">평가일</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="brand-gradient w-full rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "생성 중…" : "시험 만들기 → 출제"}
      </button>
    </div>
  );
}
