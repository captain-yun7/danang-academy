"use client";

import { useState, useTransition } from "react";
import { updateThresholds } from "./actions";

type Thresholds = Record<"beginner" | "elementary" | "intermediate" | "advanced", [number, number]>;

const ROWS: { key: keyof Thresholds; label: string }[] = [
  { key: "beginner", label: "입문반" },
  { key: "elementary", label: "초급반" },
  { key: "intermediate", label: "중급반" },
  { key: "advanced", label: "고급반" },
];

export function ThresholdEditor({ initial }: { initial: Thresholds }) {
  const [v, setV] = useState<Thresholds>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function set(level: keyof Thresholds, idx: 0 | 1, val: number) {
    setV((prev) => {
      const next = { ...prev };
      const tuple = [...next[level]] as [number, number];
      tuple[idx] = val;
      next[level] = tuple;
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--color-muted)]">
            <th className="text-left font-semibold">반</th>
            <th className="font-semibold">최소</th>
            <th className="font-semibold">최대</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} className="border-t border-[var(--color-line)]">
              <td className="py-2 font-semibold">{r.label}</td>
              <td className="py-2 text-center">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={v[r.key][0]}
                  onChange={(e) => set(r.key, 0, Number(e.target.value))}
                  className="w-16 rounded border border-[var(--color-line)] px-2 py-1 text-center"
                />
              </td>
              <td className="py-2 text-center">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={v[r.key][1]}
                  onChange={(e) => set(r.key, 1, Number(e.target.value))}
                  className="w-16 rounded border border-[var(--color-line)] px-2 py-1 text-center"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--color-muted)]">
          가중치 합 점수가 [최소, 최대] 구간에 들면 그 반으로 추천됩니다.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              try {
                await updateThresholds(v);
                setMsg("저장됨 ✓");
                setTimeout(() => setMsg(null), 2000);
              } catch {
                setMsg("저장 실패");
              }
            });
          }}
          className="brand-gradient rounded-full px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
      {msg && (
        <p className="mt-2 text-right text-xs font-semibold text-emerald-600">
          {msg}
        </p>
      )}
    </div>
  );
}
