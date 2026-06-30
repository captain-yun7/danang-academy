"use client";

import { useState, useTransition } from "react";
import { saveExamComment } from "../../../actions";

export function ExamCommentEditor({
  examId,
  attemptId,
  initial,
}: {
  examId: string;
  attemptId: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = text !== saved;

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await saveExamComment({ examId, attemptId, comment: text });
        setSaved(text);
        setMsg("저장됨");
      } catch {
        setMsg("저장 실패");
      }
    });
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="‘코멘트 일괄 생성’으로 AI 초안을 만든 뒤 다듬으세요."
        className="w-full resize-y rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed outline-none focus:border-[var(--color-primary)] print:resize-none print:border-0 print:p-0"
      />
      <div className="mt-2 flex items-center justify-end gap-3 print:hidden">
        {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
        <button onClick={save} disabled={pending || !dirty} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50">
          {pending ? "저장 중…" : "코멘트 저장"}
        </button>
      </div>
    </div>
  );
}
