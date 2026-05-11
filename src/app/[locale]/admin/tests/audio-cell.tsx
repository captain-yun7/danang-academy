"use client";

import { useState, useTransition } from "react";
import { getTestAudioUrl } from "./actions";

export function AudioCell({
  testId,
  type,
}: {
  testId: string;
  type: "free_pron" | "placement";
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (url) {
    return (
      <audio
        src={url}
        controls
        autoPlay
        className="h-8 w-full max-w-[260px]"
        onError={() => setError("재생 실패 — Mock 시절 파일이거나 만료")}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await getTestAudioUrl({ testId, type });
              if (res.ok) {
                setUrl(res.url);
              } else {
                setError(
                  res.error === "no_audio"
                    ? "녹음 없음"
                    : res.error === "r2_disabled"
                      ? "R2 미설정"
                      : "권한 없음"
                );
              }
            } catch {
              setError("오류");
            }
          });
        }}
        className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs font-bold hover:border-[var(--color-ink)] disabled:opacity-50"
      >
        {pending ? "..." : "🔊 듣기"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
