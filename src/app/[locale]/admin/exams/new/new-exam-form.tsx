"use client";

import { useState, useTransition } from "react";
import { createTest } from "../actions";

export function NewTestForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [lessonRange, setLessonRange] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cls = "mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

  function submit() {
    setErr(null);
    if (!classId || !title.trim()) { setErr("반과 제목을 입력하세요."); return; }
    start(async () => {
      try {
        await createTest({ classId, title: title.trim(), lessonRange: lessonRange.trim() || undefined });
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        setErr("시험 생성에 실패했습니다.");
      }
    });
  }

  if (classes.length === 0)
    return <p className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">먼저 반을 생성하세요.</p>;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">반</span>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={cls}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">시험 제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 주간 테스트 1~2과" className={cls} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">과범위 <span className="font-normal text-[var(--color-muted)]">(선택)</span></span>
        <input value={lessonRange} onChange={(e) => setLessonRange(e.target.value)} placeholder="예: 1~2" className={cls} />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button onClick={submit} disabled={pending} className="brand-gradient w-full rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {pending ? "생성 중…" : "시험 만들기 → 출제"}
      </button>
    </div>
  );
}
