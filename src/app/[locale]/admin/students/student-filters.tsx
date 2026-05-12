"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";

type Class = { id: string; name: string };

export function StudentFilters({
  classes,
  initial,
}: {
  classes: Class[];
  initial: { q: string; status: string | null; level: string | null; classFilter: string | null };
}) {
  const t = useTranslations("admin.students.filters");
  const tStatus = useTranslations("admin.students.status");
  const tLevel = useTranslations("admin.students.level");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q);

  useEffect(() => {
    const tm = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      const url = `${pathname}?${next.toString()}`;
      if (url !== `${pathname}?${sp.toString()}`) {
        startTransition(() => router.replace(url));
      }
    }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function clearAll() {
    setQ("");
    startTransition(() => router.replace(pathname));
  }

  const hasFilter = !!(initial.q || initial.status || initial.level || initial.classFilter);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_180px_auto]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        className="rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
      />
      <select
        value={initial.status ?? ""}
        onChange={(e) => setParam("status", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">{t("allStatus")}</option>
        <option value="active">{tStatus("active")}</option>
        <option value="paused">{tStatus("paused")}</option>
        <option value="graduated">{tStatus("graduated")}</option>
        <option value="dropped">{tStatus("dropped")}</option>
      </select>
      <select
        value={initial.level ?? ""}
        onChange={(e) => setParam("level", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">{t("allLevel")}</option>
        <option value="beginner">{tLevel("beginner")}</option>
        <option value="elementary">{tLevel("elementary")}</option>
        <option value="intermediate">{tLevel("intermediate")}</option>
        <option value="advanced">{tLevel("advanced")}</option>
      </select>
      <select
        value={initial.classFilter ?? ""}
        onChange={(e) => setParam("class", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">{t("allClass")}</option>
        <option value="none">{t("unassigned")}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {hasFilter && (
        <button
          type="button"
          onClick={clearAll}
          disabled={pending}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-xs font-semibold hover:border-[var(--color-ink)]"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
