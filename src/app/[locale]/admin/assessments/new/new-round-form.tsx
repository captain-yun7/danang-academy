"use client";

import { useMemo, useState, useTransition } from "react";
import { createRound } from "../actions";

type Assignment = {
  id: string;
  title: string;
  type: string;
  class_id: string | null;
  target_type: string;
  due_date: string | null;
};

export function NewRoundForm({
  classes,
  assignments,
}: {
  classes: { id: string; name: string }[];
  assignments: Assignment[];
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [pronId, setPronId] = useState("");
  const [writingId, setWritingId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 선택한 반에 해당하는 과제만 (그 반 지정 or 전체 대상)
  const forClass = useMemo(
    () => assignments.filter((a) => a.target_type === "all" || a.class_id === classId),
    [assignments, classId]
  );
  const pronOptions = forClass.filter((a) => a.type === "pronunciation");
  const writingOptions = forClass.filter((a) => a.type === "writing");

  // 반이 바뀌면 그 반에 없는 연결은 초기화
  function changeClass(id: string) {
    setClassId(id);
    if (pronId && !assignments.some((a) => a.id === pronId && (a.target_type === "all" || a.class_id === id)))
      setPronId("");
    if (writingId && !assignments.some((a) => a.id === writingId && (a.target_type === "all" || a.class_id === id)))
      setWritingId("");
  }

  function submit() {
    setErr(null);
    if (!classId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr("반, 제목, 평가일을 모두 입력하세요.");
      return;
    }
    startTransition(async () => {
      try {
        await createRound({
          classId,
          title: title.trim(),
          date,
          pronunciationAssignmentId: pronId,
          writingAssignmentId: writingId,
        });
      } catch (e) {
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

  const selectCls =
    "mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

  function label(a: Assignment) {
    return a.due_date ? `${a.title} (${a.due_date})` : a.title;
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">반</span>
        <select value={classId} onChange={(e) => changeClass(e.target.value)} className={selectCls}>
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
          className={selectCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold">평가일</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={selectCls} />
      </label>

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-soft)]/50 p-4">
        <p className="text-sm font-semibold">과제 연동 (선택)</p>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          연결하면 그리드의 발음·쓰기 점수가 해당 과제에서 자동으로 채워집니다.
        </p>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[var(--color-muted)]">발음 연동</span>
          <select value={pronId} onChange={(e) => setPronId(e.target.value)} className={selectCls}>
            <option value="">연동 안 함 (수동 입력)</option>
            {pronOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[var(--color-muted)]">쓰기 연동</span>
          <select value={writingId} onChange={(e) => setWritingId(e.target.value)} className={selectCls}>
            <option value="">연동 안 함 (수동 입력)</option>
            {writingOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
        </label>
      </div>

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
