"use client";

import { useState, useTransition } from "react";
import { toggleMcqActive } from "./actions";

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const [isActive, setIsActive] = useState(active);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !isActive;
        setIsActive(next);
        startTransition(async () => {
          try {
            await toggleMcqActive({ id, active: next });
          } catch {
            setIsActive(!next);
          }
        });
      }}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
        isActive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-gray-200 text-gray-500"
      }`}
    >
      {isActive ? "활성" : "비활성"}
    </button>
  );
}
