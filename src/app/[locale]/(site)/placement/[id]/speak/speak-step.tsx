"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startPlacementPronunciation,
  linkPronunciationToPlacement,
} from "../../actions";

const MAX_DURATION_SEC = 30;

type Phase = "idle" | "recording" | "review" | "uploading";

export function SpeakStep({
  placementId,
  visitorName,
  nativeLanguage,
  koreanLevel,
  targetSentence,
}: {
  placementId: string;
  visitorName: string;
  nativeLanguage: string;
  koreanLevel: string;
  targetSentence: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAtRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopAtRef.current) clearTimeout(stopAtRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("review");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
      stopAtRef.current = setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, MAX_DURATION_SEC * 1000);
    } catch (e) {
      setError(
        "마이크 권한이 필요합니다. " +
          (e instanceof Error ? `(${e.message})` : "")
      );
    }
  }

  function stop() {
    const mr = mediaRecorderRef.current;
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
      const created = await startPlacementPronunciation({
        placementId,
        visitorName,
        nativeLanguage: nativeLanguage as "vi" | "en" | "other",
        koreanLevel: koreanLevel as
          | "beginner"
          | "elementary"
          | "intermediate"
          | "advanced",
        targetSentence,
      });
      if (!created.ok) {
        throw new Error(created.error);
      }
      const res = await fetch(
        `/api/free-pronunciation/upload?id=${encodeURIComponent(created.pronunciationTestId)}`,
        {
          method: "POST",
          headers: {
            "content-type": blobRef.current.type || "audio/webm",
          },
          body: blobRef.current,
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status}`);
      }
      const linked = await linkPronunciationToPlacement({
        id: placementId,
        pronunciationTestId: created.pronunciationTestId,
      });
      if (!linked.ok) throw new Error(linked.error || "link failed");
      router.push(`/placement/${placementId}/wait`);
    } catch (e) {
      setError(`업로드 실패: ${e instanceof Error ? e.message : "unknown"}`);
      setPhase("review");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      {phase === "idle" && (
        <div className="text-center">
          <button
            type="button"
            onClick={start}
            className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
          >
            🎙️ 녹음 시작
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
              녹음 중... {elapsed}s / {MAX_DURATION_SEC}s
            </span>
          </div>
          <button
            type="button"
            onClick={stop}
            className="rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--color-primary-deep)]"
          >
            ⏹️ 녹음 정지
          </button>
        </div>
      )}

      {phase === "review" && audioUrl && (
        <div className="flex flex-col gap-4">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border-2 border-[var(--color-line)] px-5 py-2.5 text-sm font-bold hover:border-[var(--color-ink)]"
            >
              다시 녹음
            </button>
            <button
              type="button"
              onClick={submit}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90"
            >
              제출하고 결과 보기 →
            </button>
          </div>
        </div>
      )}

      {phase === "uploading" && (
        <p className="text-center text-sm font-semibold text-[var(--color-muted)]">
          업로드 중...
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
