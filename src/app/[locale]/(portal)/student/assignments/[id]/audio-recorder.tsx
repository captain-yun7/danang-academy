"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 공용 녹음기 — 녹음/미리듣기/제출 단계 관리.
 * onSubmit이 throw하면 에러를 보여주고 review 상태로 복귀.
 */
export function AudioRecorder({
  maxDurationSec,
  onSubmit,
}: {
  maxDurationSec: number;
  onSubmit: (blob: Blob, durationSec: number) => Promise<void>;
}) {
  const t = useTranslations("studentPortal.run");
  const [phase, setPhase] = useState<"idle" | "recording" | "review" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAtRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopAtRef.current) clearTimeout(stopAtRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      const startedAt = Date.now();
      mr.onstop = () => {
        durationRef.current = Math.min(
          Math.round((Date.now() - startedAt) / 1000),
          maxDurationSec
        );
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("review");
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      mrRef.current = mr;
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
      stopAtRef.current = setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, maxDurationSec * 1000);
    } catch (e) {
      setError(t("errorMic") + (e instanceof Error ? ` (${e.message})` : ""));
    }
  }

  function stop() {
    const mr = mrRef.current;
    if (mr && mr.state === "recording") {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopAtRef.current) clearTimeout(stopAtRef.current);
      mr.stop();
    }
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setPhase("idle");
  }

  async function submit() {
    if (!blobRef.current) return;
    setPhase("uploading");
    setError(null);
    try {
      await onSubmit(blobRef.current, durationRef.current);
    } catch (e) {
      setError(`${t("errorUpload")}: ${e instanceof Error ? e.message : "unknown"}`);
      setPhase("review");
    }
  }

  return (
    <div>
      {phase === "idle" && (
        <div className="text-center">
          <button
            type="button"
            onClick={start}
            className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
          >
            {t("start")}
          </button>
        </div>
      )}
      {phase === "recording" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-semibold">
              {t("recording")} {elapsed}s / {maxDurationSec}s
            </span>
          </div>
          <button
            type="button"
            onClick={stop}
            className="rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--color-primary-deep)]"
          >
            {t("stop")}
          </button>
        </div>
      )}
      {phase === "review" && audioUrl && (
        <div className="flex flex-col gap-4">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border-2 border-[var(--color-line)] px-5 py-2.5 text-sm font-bold hover:border-[var(--color-ink)]"
            >
              {t("retryRecord")}
            </button>
            <button
              type="button"
              onClick={submit}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90"
            >
              {t("submit")}
            </button>
          </div>
        </div>
      )}
      {phase === "uploading" && (
        <p className="text-center text-sm font-semibold text-[var(--color-muted)]">{t("uploading")}</p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      )}
    </div>
  );
}
