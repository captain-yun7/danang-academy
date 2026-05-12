"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateThresholds } from "./actions";

type Thresholds = Record<"beginner" | "elementary" | "intermediate" | "advanced", [number, number]>;

const ROW_KEYS: (keyof Thresholds)[] = ["beginner", "elementary", "intermediate", "advanced"];

export function ThresholdEditor({ initial }: { initial: Thresholds }) {
  const t = useTranslations("admin.mcq");
  const tLevel = useTranslations("admin.mcq.levelClass");
  const tCommon = useTranslations("admin.common");
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
            <th className="text-left font-semibold"></th>
            <th className="font-semibold">{t("minCol")}</th>
            <th className="font-semibold">{t("maxCol")}</th>
          </tr>
        </thead>
        <tbody>
          {ROW_KEYS.map((k) => (
            <tr key={k} className="border-t border-[var(--color-line)]">
              <td className="py-2 font-semibold">{tLevel(k)}</td>
              <td className="py-2 text-center">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={v[k][0]}
                  onChange={(e) => set(k, 0, Number(e.target.value))}
                  className="w-16 rounded border border-[var(--color-line)] px-2 py-1 text-center"
                />
              </td>
              <td className="py-2 text-center">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={v[k][1]}
                  onChange={(e) => set(k, 1, Number(e.target.value))}
                  className="w-16 rounded border border-[var(--color-line)] px-2 py-1 text-center"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--color-muted)]">{t("thresholdHint")}</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              try {
                await updateThresholds(v);
                setMsg(tCommon("saved"));
                setTimeout(() => setMsg(null), 2000);
              } catch {
                setMsg(tCommon("error"));
              }
            });
          }}
          className="brand-gradient rounded-full px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? tCommon("saving") : tCommon("save")}
        </button>
      </div>
      {msg && (
        <p className="mt-2 text-right text-xs font-semibold text-emerald-600">{msg}</p>
      )}
    </div>
  );
}
