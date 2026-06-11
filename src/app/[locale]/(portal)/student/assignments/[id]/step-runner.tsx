"use client";

import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import {
  getMyStepSubmission,
  getStepItemTtsUrl,
  type StudentAssignmentDetail,
  type StudentStep,
  type MyStepSubmissionResult,
} from "../../actions";
import { AudioRecorder } from "./audio-recorder";

type StepSub = NonNullable<MyStepSubmissionResult>;

const SUB_SCORES = [
  ["accuracy_score", "accuracy", 40],
  ["pronunciation_score", "pronunciation", 30],
  ["fluency_score", "fluency", 20],
  ["completion_score", "completion", 10],
] as const;

export function StepRunner({ detail }: { detail: StudentAssignmentDetail }) {
  const t = useTranslations("studentPortal.steps");
  const tRun = useTranslations("studentPortal.run");
  const { mutate: mutateGlobal } = useSWRConfig();
  const steps = detail.steps;

  const [subs, setSubs] = useState<Record<number, StepSub | undefined>>(() =>
    Object.fromEntries(detail.stepSubmissions.map((s) => [s.step_no, s]))
  );
  // 다시 녹음 중인 단계 번호 (제출 이력이 있어도 녹음 화면을 보여줌)
  const [rerecording, setRerecording] = useState<number | null>(null);

  const firstIncomplete = steps.find((s) => subs[s.stepNo]?.status !== "completed")?.stepNo ?? null;
  const allDone = firstIncomplete === null;

  // 재방문 시 첫 미완료 단계로, 전부 완료면 최종 요약으로
  const [view, setView] = useState<{ kind: "step"; stepNo: number } | { kind: "summary" }>(() => {
    const first =
      detail.steps.find(
        (s) => detail.stepSubmissions.find((x) => x.step_no === s.stepNo)?.status !== "completed"
      )?.stepNo ?? null;
    return first !== null ? { kind: "step", stepNo: first } : { kind: "summary" };
  });

  const curStepNo = view.kind === "step" ? view.stepNo : null;
  const curStep = steps.find((s) => s.stepNo === curStepNo) ?? null;
  const curSub = curStepNo !== null ? subs[curStepNo] : undefined;
  const mode: "record" | "result" =
    curStepNo !== null && rerecording !== curStepNo && curSub ? "result" : "record";

  // 현재 단계 결과 폴링 — 완료/실패 시 중단
  const { data: polled } = useSWR<MyStepSubmissionResult>(
    curStepNo !== null && mode === "result" ? `stepsub:${detail.id}:${curStepNo}` : null,
    () => getMyStepSubmission(detail.id, curStepNo!),
    {
      fallbackData: curSub ?? null,
      refreshInterval: (latest) =>
        latest?.status === "completed" || latest?.status === "failed" ? 0 : 2500,
      revalidateOnFocus: false,
      onSuccess: (d) => {
        if (d && curStepNo !== null) setSubs((m) => ({ ...m, [curStepNo]: d }));
      },
    }
  );

  // 항목별 모범음성 재생 — presigned URL은 1회 받아 캐시
  const urlCache = useRef(new Map<string, string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  async function playItem(key: string) {
    audioRef.current?.pause();
    setPlayingKey(key);
    try {
      let url = urlCache.current.get(key);
      if (!url) {
        const fetched = await getStepItemTtsUrl(detail.id, key);
        if (!fetched) {
          setPlayingKey(null);
          return;
        }
        urlCache.current.set(key, fetched);
        url = fetched;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingKey(null);
      audio.onerror = () => setPlayingKey(null);
      await audio.play();
    } catch {
      setPlayingKey(null);
    }
  }

  async function uploadStep(stepNo: number, blob: Blob, durationSec: number) {
    const qs = new URLSearchParams({
      assignmentId: detail.id,
      stepNo: String(stepNo),
      durationSec: String(durationSec),
    });
    const res = await fetch(`/api/assignments/submit-step-audio?${qs}`, {
      method: "POST",
      headers: { "content-type": blob.type || "audio/webm" },
      body: blob,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `${res.status}`);
    }
    const placeholder: StepSub = {
      status: "processing",
      total_score: null,
      accuracy_score: null,
      pronunciation_score: null,
      fluency_score: null,
      completion_score: null,
      transcript: null,
      strengths: null,
      improvements: null,
    };
    setRerecording(null);
    setSubs((m) => ({ ...m, [stepNo]: placeholder }));
    // 재제출 시 SWR 캐시에 남은 이전 완료 결과를 비워야 폴링이 다시 돈다
    void mutateGlobal(`stepsub:${detail.id}:${stepNo}`, placeholder, { revalidate: false });
  }

  function goNext(fromStepNo: number) {
    const next = steps.find((s) => s.stepNo > fromStepNo);
    if (next) setView({ kind: "step", stepNo: next.stepNo });
    else setView({ kind: "summary" });
  }

  return (
    <div className="grid gap-5">
      {/* 진행 헤더 1→2→3→4 */}
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => {
          const done = subs[s.stepNo]?.status === "completed";
          const active = view.kind === "step" && view.stepNo === s.stepNo;
          const clickable = done || s.stepNo === firstIncomplete;
          return (
            <li key={s.stepNo} className="flex items-center gap-2">
              {i > 0 && <span className="text-xs text-[var(--color-muted)]">→</span>}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  setRerecording(null);
                  setView({ kind: "step", stepNo: s.stepNo });
                }}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                } ${clickable ? "" : "cursor-not-allowed opacity-60"}`}
              >
                {done && !active ? "✓" : s.stepNo}
                <span className="hidden sm:inline">{t(`types.${s.stepType}`)}</span>
              </button>
            </li>
          );
        })}
        {allDone && (
          <li className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)]">→</span>
            <button
              type="button"
              onClick={() => setView({ kind: "summary" })}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold ${
                view.kind === "summary"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
              }`}
            >
              {t("summaryTitle")}
            </button>
          </li>
        )}
      </ol>

      {view.kind === "summary" ? (
        <StepSummary
          steps={steps}
          subs={subs}
          onGoStep={(stepNo) => {
            setRerecording(null);
            setView({ kind: "step", stepNo });
          }}
        />
      ) : curStep ? (
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            STEP {curStep.stepNo} · {t(`types.${curStep.stepType}`)}
          </p>
          {curStep.title && <p className="mt-1 text-base font-bold">{curStep.title}</p>}

          {/* 항목 목록 + 항목별 모범음성 */}
          <ul className="mt-3 grid gap-2">
            {curStep.items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-soft)] px-3 py-2.5"
              >
                <span className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">
                  {item.text}
                </span>
                {item.ttsStatus === "ready" && item.ttsKey ? (
                  <button
                    type="button"
                    onClick={() => playItem(item.ttsKey!)}
                    className={`shrink-0 rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                      playingKey === item.ttsKey
                        ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                        : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                    }`}
                  >
                    ▶ {t("listen")}
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                    {t("ttsPending")}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            {mode === "record" ? (
              <div>
                <p className="mb-4 text-center text-sm font-semibold text-[var(--color-muted)]">
                  {t("recordHint")}
                </p>
                <AudioRecorder
                  // 최종 발화(passage)는 60초, 그 외 30초
                  maxDurationSec={curStep.stepType === "passage" ? 60 : 30}
                  onSubmit={(blob, durationSec) => uploadStep(curStep.stepNo, blob, durationSec)}
                />
              </div>
            ) : (
              <StepResult
                data={polled ?? curSub ?? null}
                isLast={steps.findIndex((s) => s.stepNo > curStep.stepNo) === -1}
                allDone={allDone}
                onRerecord={() => setRerecording(curStep.stepNo)}
                onNext={() => goNext(curStep.stepNo)}
              />
            )}
          </div>
        </section>
      ) : null}

      {view.kind === "step" && allDone && (
        <p className="text-center text-xs font-semibold text-emerald-600">✓ {tRun("submittedDone")}</p>
      )}
    </div>
  );
}

/* ------------------------- 단계 결과 ------------------------- */

function StepResult({
  data,
  isLast,
  allDone,
  onRerecord,
  onNext,
}: {
  data: MyStepSubmissionResult;
  isLast: boolean;
  allDone: boolean;
  onRerecord: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("studentPortal.steps");
  const tRun = useTranslations("studentPortal.run");
  const status = data?.status ?? "processing";

  if (status === "pending" || status === "processing") {
    return (
      <div className="rounded-xl bg-[var(--color-soft)] p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-primary)]" />
        <p className="mt-4 text-sm font-semibold text-[var(--color-muted)]">{tRun("analyzing")}</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{tRun("failed")}</p>
        <button
          type="button"
          onClick={onRerecord}
          className="mt-4 rounded-full border-2 border-red-300 px-5 py-2 text-xs font-bold text-red-700"
        >
          {tRun("retryRecord")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--color-soft)] p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-[var(--color-primary-deep)]">
          {data?.total_score}
        </span>
        <span className="text-sm font-semibold text-[var(--color-muted)]">/100</span>
      </div>

      <div className="mt-4 grid gap-2.5">
        {SUB_SCORES.map(([field, labelKey, max]) => (
          <ScoreBar key={field} label={t(`scores.${labelKey}`)} value={data?.[field] ?? 0} max={max} />
        ))}
      </div>

      {data?.strengths && (
        <p className="mt-4 text-sm">
          <span className="font-bold text-emerald-700">{tRun("strengths")}</span>
          <br />
          {data.strengths}
        </p>
      )}
      {data?.improvements && (
        <p className="mt-3 text-sm">
          <span className="font-bold text-amber-700">{tRun("improvements")}</span>
          <br />
          {data.improvements}
        </p>
      )}
      {data?.transcript && (
        <p className="mt-4 rounded-lg bg-white p-3 text-xs text-[var(--color-muted)]">
          <span className="font-semibold">{tRun("transcript")}:</span> {data.transcript}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRerecord}
          className="rounded-full border-2 border-[var(--color-line)] px-5 py-2 text-xs font-bold hover:border-[var(--color-ink)]"
        >
          {tRun("retryRecord")}
        </button>
        {isLast ? (
          allDone && (
            <button
              type="button"
              onClick={onNext}
              className="brand-gradient rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
            >
              {t("viewSummary")}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="brand-gradient rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
          >
            {t("next")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------- 최종 요약 ------------------------- */

function StepSummary({
  steps,
  subs,
  onGoStep,
}: {
  steps: StudentStep[];
  subs: Record<number, StepSub | undefined>;
  onGoStep: (stepNo: number) => void;
}) {
  const t = useTranslations("studentPortal.steps");
  const completed = steps
    .map((s) => subs[s.stepNo])
    .filter((s): s is StepSub => s?.status === "completed");

  const avg = (field: (typeof SUB_SCORES)[number][0] | "total_score") => {
    if (completed.length === 0) return 0;
    return Math.round(
      completed.reduce((sum, s) => sum + (s[field] ?? 0), 0) / completed.length
    );
  };

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("summaryTitle")}
      </p>
      <p className="mt-1 text-sm font-semibold text-emerald-600">✓ {t("summaryDone")}</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-black text-[var(--color-primary-deep)]">
          {avg("total_score")}
        </span>
        <span className="text-sm font-semibold text-[var(--color-muted)]">/100</span>
      </div>

      <div className="mt-5 grid gap-2.5">
        {SUB_SCORES.map(([field, labelKey, max]) => (
          <ScoreBar key={field} label={t(`scores.${labelKey}`)} value={avg(field)} max={max} />
        ))}
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("perStep")}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <button
            key={s.stepNo}
            type="button"
            onClick={() => onGoStep(s.stepNo)}
            className="group rounded-lg bg-[var(--color-soft)] p-3 text-center transition hover:ring-2 hover:ring-[var(--color-primary)]"
          >
            <p className="text-[11px] font-bold text-[var(--color-muted)]">
              STEP {s.stepNo} · {t(`types.${s.stepType}`)}
            </p>
            <p className="mt-1 text-xl font-black text-[var(--color-primary-deep)]">
              {subs[s.stepNo]?.total_score ?? "-"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--color-primary)] opacity-70 group-hover:opacity-100">
              ↻ {t("retryStep")}
            </p>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--color-muted)]">{t("summaryRetryHint")}</p>
    </section>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="font-bold text-[var(--color-primary-deep)]">
          {value}
          <span className="font-semibold text-[var(--color-muted)]">/{max}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div className="brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
