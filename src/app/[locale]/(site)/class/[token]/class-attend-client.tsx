"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  searchStudent,
  submitAttendance,
  type SearchStudentRow,
  type AttendResult,
} from "./actions";

type Props = {
  classToken: string;
  classId: string;
  organizationId: string;
  className: string;
  sessionTimeLabel: string;
};

type GpsState =
  | { kind: "init" }
  | { kind: "asking" }
  | { kind: "ok"; lat: number; lng: number }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "timeout" };

export function ClassAttendClient({
  classToken,
  classId,
  organizationId,
  className,
  sessionTimeLabel,
}: Props) {
  const t = useTranslations("classAttend");
  const [gps, setGps] = useState<GpsState>({ kind: "init" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchStudentRow[]>([]);
  const [searchPending, startSearch] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [outcome, setOutcome] = useState<AttendResult | null>(null);

  // GPS 권한 요청 (마운트 시)
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGps({ kind: "unavailable" });
      return;
    }
    setGps({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          kind: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGps({ kind: "denied" });
        else if (err.code === err.TIMEOUT) setGps({ kind: "timeout" });
        else setGps({ kind: "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // 디바운스 검색
  useEffect(() => {
    if (gps.kind !== "ok") return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchStudent({ classId, organizationId, query });
        setResults(rows);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, classId, organizationId, gps.kind]);

  function handlePick(student: SearchStudentRow) {
    if (gps.kind !== "ok") return;
    startSubmit(async () => {
      const result = await submitAttendance({
        classToken,
        studentId: student.id,
        lat: gps.lat,
        lng: gps.lng,
      });
      setOutcome(result);
    });
  }

  // 결과 화면 우선
  if (outcome) {
    return <OutcomeView outcome={outcome} onRetry={() => setOutcome(null)} />;
  }

  // GPS 에러 화면
  if (gps.kind === "denied") {
    return <ErrorView title={t("err.gpsDeniedTitle")} desc={t("err.gpsDeniedDesc")} />;
  }
  if (gps.kind === "unavailable") {
    return <ErrorView title={t("err.gpsUnavailTitle")} desc={t("err.gpsUnavailDesc")} />;
  }
  if (gps.kind === "timeout") {
    return (
      <ErrorView
        title={t("err.gpsTimeoutTitle")}
        desc={t("err.gpsTimeoutDesc")}
        onRetry={() => window.location.reload()}
        retryLabel={t("retry")}
      />
    );
  }

  // GPS 요청 중
  if (gps.kind !== "ok") {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-6 text-sm text-[var(--color-muted)]">{t("gpsAsking")}</p>
      </main>
    );
  }

  // 본인 찾기 화면
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-black">{className}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{sessionTimeLabel}</p>
      </div>

      <div className="mt-8">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">{t("searchLabel")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            inputMode="text"
            autoComplete="off"
            className="w-full rounded-xl border-2 border-[var(--color-line)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">
          {t("searchHint")}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {searchPending && (
          <li className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-center text-sm text-[var(--color-muted)]">
            {t("searching")}
          </li>
        )}
        {!searchPending && query.trim().length >= 2 && results.length === 0 && (
          <li className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-center text-sm text-[var(--color-muted)]">
            {t("noMatch")}
          </li>
        )}
        {results.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={submitPending}
              onClick={() => handlePick(s)}
              className="w-full rounded-xl border-2 border-[var(--color-line)] bg-white p-4 text-left transition hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              <p className="text-base font-bold">{s.name}</p>
              {s.hint && (
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {t("enrolledAt", { date: s.hint })}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>

      {submitPending && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white px-6 py-5 text-sm font-bold">
            {t("submitting")}
          </div>
        </div>
      )}
    </main>
  );
}

function OutcomeView({
  outcome,
  onRetry,
}: {
  outcome: AttendResult;
  onRetry: () => void;
}) {
  const t = useTranslations("classAttend");
  if (outcome.ok) {
    const isLate = outcome.status === "late";
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full text-6xl ${
            isLate ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          ✓
        </div>
        <p
          className={`mt-6 text-xs font-bold uppercase tracking-widest ${
            isLate ? "text-amber-600" : "text-emerald-600"
          }`}
        >
          {isLate ? t("ok.lateTag") : t("ok.presentTag")}
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {t("ok.title", { name: outcome.studentName })}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {outcome.time} · {outcome.className}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {isLate ? t("ok.lateDesc") : t("ok.presentDesc")}
        </p>
      </main>
    );
  }

  // 실패별 메시지
  const map: Record<
    Exclude<AttendResult, { ok: true }>["reason"],
    { title: string; desc: string }
  > = {
    no_session: { title: t("err.noSessionTitle"), desc: t("err.noSessionDesc") },
    gps_out: { title: t("err.gpsOutTitle"), desc: t("err.gpsOutDesc") },
    not_in_class: { title: t("err.notInClassTitle"), desc: t("err.notInClassDesc") },
    fp_dup: { title: t("err.fpDupTitle"), desc: t("err.fpDupDesc") },
    already: {
      title: t("err.alreadyTitle"),
      desc: t("err.alreadyDesc", { time: outcome.alreadyTime ?? "—" }),
    },
  };
  const m = map[outcome.reason];
  return <ErrorView title={m.title} desc={m.desc} onRetry={onRetry} retryLabel={t("back")} />;
}

function ErrorView({
  title,
  desc,
  onRetry,
  retryLabel,
}: {
  title: string;
  desc: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-5xl text-red-500">
        !
      </div>
      <h1 className="mt-6 text-2xl font-black">{title}</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{desc}</p>
      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-8 rounded-full border-2 border-[var(--color-line)] px-6 py-2 text-sm font-bold"
        >
          {retryLabel}
        </button>
      )}
    </main>
  );
}
