"use client";

import { useState, useTransition } from "react";
import { updateGradeCuts } from "./actions";

type Cuts = { excellent: number; good: number; normal: number };

export function GradeCutForm({ initial }: { initial: Cuts }) {
  const [excellent, setExcellent] = useState(String(initial.excellent));
  const [good, setGood] = useState(String(initial.good));
  const [normal, setNormal] = useState(String(initial.normal));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const e = Number(excellent);
  const g = Number(good);
  const n = Number(normal);
  const valid =
    [e, g, n].every((v) => Number.isInteger(v) && v >= 1 && v <= 100) && e > g && g > n;

  function save() {
    setMsg(null);
    if (!valid) {
      setMsg({ kind: "err", text: "1~100 정수 · 우수 > 양호 > 보통 순서여야 합니다." });
      return;
    }
    startTransition(async () => {
      try {
        await updateGradeCuts({ excellent: e, good: g, normal: n });
        setMsg({ kind: "ok", text: "저장되었습니다." });
      } catch {
        setMsg({ kind: "err", text: "저장에 실패했습니다." });
      }
    });
  }

  const fields: { label: string; tone: string; value: string; set: (v: string) => void; hint: string }[] = [
    { label: "우수", tone: "text-emerald-700", value: excellent, set: setExcellent, hint: "이상" },
    { label: "양호", tone: "text-sky-700", value: good, set: setGood, hint: "이상" },
    { label: "보통", tone: "text-amber-700", value: normal, set: setNormal, hint: "이상 (미만은 보충 필요)" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className={`text-sm font-bold ${f.tone}`}>{f.label}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={f.value}
                onChange={(ev) => f.set(ev.target.value)}
                className="w-20 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-xs text-[var(--color-muted)]">점 {f.hint}</span>
            </div>
          </label>
        ))}
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="brand-gradient rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "저장 중…" : "등급 기준 저장"}
        </button>
      </div>
    </div>
  );
}
