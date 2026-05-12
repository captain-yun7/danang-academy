"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPlacementResult, type PlacementResult } from "../../actions";

export function WaitClient({ id }: { id: string }) {
  const t = useTranslations("pt.wait");
  const router = useRouter();
  const { data } = useSWR<PlacementResult | null>(
    `pt:${id}`,
    () => getPlacementResult(id),
    {
      refreshInterval: (latest) =>
        latest?.status === "completed" || latest?.status === "failed" ? 0 : 2500,
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data?.status === "completed") {
      router.replace(`/placement/${id}/result`);
    }
  }, [data?.status, id, router]);

  return (
    <div className="mt-8">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      <p className="mt-6 text-sm text-[var(--color-muted)]">{t("hint")}</p>
      {data?.status === "failed" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
