"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

type Class = { id: string; name: string };

export function StudentFilters({
  classes,
  initial,
}: {
  classes: Class[];
  initial: { q: string; status: string | null; level: string | null; classFilter: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q);

  // 검색어 디바운스 적용
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      const url = `${pathname}?${next.toString()}`;
      if (url !== `${pathname}?${sp.toString()}`) {
        startTransition(() => router.replace(url));
      }
    }, 300);
    return () => clearTimeout(t);
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
        placeholder="🔍 이름 또는 연락처로 검색..."
        className="rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
      />
      <select
        value={initial.status ?? ""}
        onChange={(e) => setParam("status", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">전체 상태</option>
        <option value="active">수강중</option>
        <option value="paused">휴학</option>
        <option value="graduated">수료</option>
        <option value="dropped">이탈</option>
      </select>
      <select
        value={initial.level ?? ""}
        onChange={(e) => setParam("level", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">전체 레벨</option>
        <option value="beginner">입문</option>
        <option value="elementary">초급</option>
        <option value="intermediate">중급</option>
        <option value="advanced">고급</option>
      </select>
      <select
        value={initial.classFilter ?? ""}
        onChange={(e) => setParam("class", e.target.value || null)}
        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm"
      >
        <option value="">전체 반</option>
        <option value="none">미배정</option>
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
          ✕ 초기화
        </button>
      )}
    </div>
  );
}
