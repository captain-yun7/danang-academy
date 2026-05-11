"use client";

import { useState, useTransition } from "react";
import { generateUpcomingSessions } from "../actions";

export function GenerateSessionsButton({ classId }: { classId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            try {
              const res = await generateUpcomingSessions({ classId, weeks: 4 });
              setMsg(`✓ ${res.generated}건 생성 (중복 ${res.skipped} skip)`);
              setTimeout(() => setMsg(null), 4000);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "오류");
            }
          });
        }}
        className="brand-gradient rounded-full px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "생성 중..." : "📅 4주 회차 생성"}
      </button>
    </div>
  );
}
