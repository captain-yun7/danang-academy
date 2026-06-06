"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  getMySubmission,
  submitWriting,
  type StudentAssignmentDetail,
  type MySubmissionResult,
} from "../../actions";

const MAX_DURATION_SEC = 30;

export function AssignmentRunner({ detail }: { detail: StudentAssignmentDetail }) {
  if (detail.type === "pronunciation") {
    return <PronunciationRunner detail={detail} />;
  }
  return <WritingRunner detail={detail} />;
}

/* ------------------------- 발음 ------------------------- */

function PronunciationRunner({ detail }: { detail: StudentAssignmentDetail }) {
  const t = useTranslations("studentPortal.run");
  const initialStatus = detail.submission?.status ?? null;
  // 이미 제출 이력이 있으면 결과 화면부터
  const [mode, setMode] = useState<"record" | "result">(
    initialStatus && initialStatus !== "pending" ? "result" : "record"
  );
  const [justSubmitted, setJustSubmitted] = useState(false);

  const polling = mode === "result";
  const { data } = useSWR<MySubmissionResult>(
    polling ? `sub:${detail.id}` : null,
    () => getMySubmission(detail.id),
    {
      fallbackData: detail.submission
        ? {
            status: detail.submission.status,
            score: detail.submission.score,
            strengths: detail.submission.strengths,
            improvements: detail.submission.improvements,
            transcript: detail.submission.transcript,
          }
        : null,
      refreshInterval: (latest) =>
        latest?.status === "completed" || latest?.status === "failed" ? 0 : 2500,
      revalidateOnFocus: false,
    }
  );

  return (
    <div className="grid gap-5">
      {detail.target_text && (
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            {t("script")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-relaxed">
            {detail.target_text}
          </p>
          {detail.ttsUrl ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-[var(--color-muted)]">{t("modelVoice")}</p>
              <audio controls src={detail.ttsUrl} className="w-full" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-muted)]">{t("modelVoicePending")}</p>
          )}
        </section>
      )}

      {mode === "record" ? (
        <StudentRecorder
          assignmentId={detail.id}
          onSubmitted={() => {
            setJustSubmitted(true);
            setMode("result");
          }}
        />
      ) : (
        <PronunciationResult
          data={data ?? null}
          justSubmitted={justSubmitted}
          onRetry={() => {
            setJustSubmitted(false);
            setMode("record");
          }}
        />
      )}
    </div>
  );
}

function PronunciationResult({
  data,
  justSubmitted,
  onRetry,
}: {
  data: MySubmissionResult;
  justSubmitted: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("studentPortal.run");
  const status = data?.status ?? "processing";

  if (status === "pending" || status === "processing") {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-white p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-primary)]" />
        <p className="mt-4 text-sm font-semibold text-[var(--color-muted)]">{t("analyzing")}</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{t("failed")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border-2 border-red-300 px-5 py-2 text-xs font-bold text-red-700"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      {justSubmitted && (
        <p className="mb-3 text-xs font-semibold text-emerald-600">✓ {t("submittedDone")}</p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-[var(--color-primary-deep)]">{data?.score}</span>
        <span className="text-sm font-semibold text-[var(--color-muted)]">/100</span>
      </div>
      {data?.strengths && (
        <p className="mt-4 text-sm">
          <span className="font-bold text-emerald-700">{t("strengths")}</span>
          <br />
          {data.strengths}
        </p>
      )}
      {data?.improvements && (
        <p className="mt-3 text-sm">
          <span className="font-bold text-amber-700">{t("improvements")}</span>
          <br />
          {data.improvements}
        </p>
      )}
      {data?.transcript && (
        <p className="mt-4 rounded-lg bg-[var(--color-soft)] p-3 text-xs text-[var(--color-muted)]">
          <span className="font-semibold">{t("transcript")}:</span> {data.transcript}
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full border-2 border-[var(--color-line)] px-5 py-2 text-xs font-bold hover:border-[var(--color-ink)]"
      >
        {t("retry")}
      </button>
    </div>
  );
}

function StudentRecorder({
  assignmentId,
  onSubmitted,
}: {
  assignmentId: string;
  onSubmitted: () => void;
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
      mr.onstop = () => {
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
      }, MAX_DURATION_SEC * 1000);
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
      const res = await fetch(
        `/api/assignments/submit-audio?assignmentId=${encodeURIComponent(assignmentId)}`,
        {
          method: "POST",
          headers: { "content-type": blobRef.current.type || "audio/webm" },
          body: blobRef.current,
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status}`);
      }
      onSubmitted();
    } catch (e) {
      setError(`${t("errorUpload")}: ${e instanceof Error ? e.message : "unknown"}`);
      setPhase("review");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      <p className="mb-4 text-center text-sm font-semibold text-[var(--color-muted)]">
        {t("recordPrompt")}
      </p>
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
              {t("recording")} {elapsed}s / {MAX_DURATION_SEC}s
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

/* ------------------------- 쓰기 ------------------------- */

function WritingRunner({ detail }: { detail: StudentAssignmentDetail }) {
  const t = useTranslations("studentPortal.run");
  const sub = detail.submission;
  const graded = sub?.status === "graded";
  const [text, setText] = useState(sub?.submission_text ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-5">
      {detail.target_text && (
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            {t("prompt")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed">
            {detail.target_text}
          </p>
        </section>
      )}

      {graded ? (
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-[var(--color-primary-deep)]">
              {sub?.teacher_score}
            </span>
            <span className="text-sm font-semibold text-[var(--color-muted)]">/100</span>
          </div>
          {sub?.teacher_comment && (
            <p className="mt-3 text-sm">
              <span className="font-bold">{t("teacherComment")}</span>
              <br />
              {sub.teacher_comment}
            </p>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--color-muted)]">{t("yourSubmission")}</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--color-soft)] p-3 text-sm">
              {sub?.submission_text}
            </p>
          </div>
        </section>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            setPending(true);
            try {
              await submitWriting({ assignmentId: detail.id, text });
              setSaved(true);
            } catch {
              setError(t("submitError"));
            } finally {
              setPending(false);
            }
          }}
          className="rounded-xl border border-[var(--color-line)] bg-white p-5"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            {t("yourAnswer")}
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            required
            maxLength={5000}
            rows={8}
            placeholder={t("writePlaceholder")}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {sub?.status === "submitted" && (
            <p className="mt-2 text-xs text-[var(--color-muted)]">{t("submittedWaiting")}</p>
          )}
          {saved && <p className="mt-2 text-xs font-semibold text-emerald-600">✓ {t("submittedDone")}</p>}
          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="brand-gradient mt-3 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
          >
            {pending ? t("submitting") : sub?.status === "submitted" ? t("resubmit") : t("submitWriting")}
          </button>
        </form>
      )}
    </div>
  );
}
