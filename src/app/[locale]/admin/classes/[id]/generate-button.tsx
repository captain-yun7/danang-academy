"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { generateUpcomingSessions } from "../actions";

export function GenerateSessionsButton({ classId }: { classId: string }) {
  const t = useTranslations("admin.classes.detail");
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
              setMsg(t("generateResult", { generated: res.generated, skipped: res.skipped }));
              setTimeout(() => setMsg(null), 4000);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "error");
            }
          });
        }}
        className="brand-gradient rounded-full px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t("generating") : t("generate")}
      </button>
    </div>
  );
}
