"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  AREA_LABELS,
  GRADE_META,
  average,
  grade,
  rankByAverage,
  total,
  type AreaKey,
  type AreaScores,
  type GradeCuts,
} from "@/lib/assessments/scoring";
import { generateComments, pullPronunciation, saveScores } from "../actions";

export type RoundStudent = {
  id: string;
  name: string;
  code: string | null;
  scores: AreaScores;
  hasComment: boolean;
};

type Tab = "grid" | "result";

export function RoundDetail({
  roundId,
  title,
  className,
  date,
  students: initial,
  cuts,
}: {
  roundId: string;
  title: string;
  className: string;
  date: string;
  students: RoundStudent[];
  cuts: GradeCuts;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("grid");
  const [students, setStudents] = useState<RoundStudent[]>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [pulling, startPull] = useTransition();
  const [genning, startGen] = useTransition();

  function setScore(sid: string, key: AreaKey, raw: string) {
    const v = raw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
    setStudents((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, scores: { ...s.scores, [key]: v } } : s))
    );
  }

  function save() {
    setMsg(null);
    startSave(async () => {
      try {
        await saveScores({
          roundId,
          rows: students.map((s) => ({
            studentId: s.id,
            listening: s.scores.listening,
            speaking: s.scores.speaking,
            reading: s.scores.reading,
            writing: s.scores.writing,
            pronunciation: s.scores.pronunciation,
          })),
        });
        setMsg("저장되었습니다.");
        router.refresh();
      } catch {
        setMsg("저장에 실패했습니다.");
      }
    });
  }

  function pull() {
    setMsg(null);
    startPull(async () => {
      try {
        const res = await pullPronunciation(roundId);
        setMsg(`발음 점수 ${res.filled}명 불러옴. (저장 버튼으로 확정)`);
        router.refresh();
      } catch {
        setMsg("발음 점수 불러오기에 실패했습니다.");
      }
    });
  }

  function genComments() {
    setMsg(null);
    startGen(async () => {
      try {
        const res = await generateComments(roundId);
        setMsg(`코멘트 ${res.count}명 생성 완료.`);
        router.refresh();
      } catch {
        setMsg("코멘트 생성에 실패했습니다.");
      }
    });
  }

  const ranked = [...students]
    .map((s) => ({ s, avg: average(s.scores) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const rankMap = rankByAverage(students);

  return (
    <div>
      <Link
        href="/admin/assessments"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
      >
        ← 주말 평가 목록
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {className} · {date} · {students.length}명
          </p>
        </div>
        {tab === "grid" ? (
          <button
            onClick={pull}
            disabled={pulling}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-60"
          >
            {pulling ? "불러오는 중…" : "발음 일괄 불러오기"}
          </button>
        ) : (
          <button
            onClick={genComments}
            disabled={genning}
            className="brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {genning ? "생성 중…" : "코멘트 일괄 생성"}
          </button>
        )}
      </div>

      {msg && (
        <p className="mt-3 rounded-lg bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-primary-deep)]">
          {msg}
        </p>
      )}

      <div className="mt-5 flex gap-2 border-b border-[var(--color-line)]">
        {(["grid", "result"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
              tab === t
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t === "grid" ? "점수 입력" : "결과 · 순위"}
          </button>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-muted)]">
          이 반에 학생이 없습니다.
        </p>
      ) : tab === "grid" ? (
        <GridTab students={students} cuts={cuts} onScore={setScore} onSave={save} saving={saving} />
      ) : (
        <ResultTab roundId={roundId} ranked={ranked} rankMap={rankMap} cuts={cuts} />
      )}
    </div>
  );
}

function GridTab({
  students,
  cuts,
  onScore,
  onSave,
  saving,
}: {
  students: RoundStudent[];
  cuts: GradeCuts;
  onScore: (sid: string, key: AreaKey, raw: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-bold">학생</th>
              {AREA_LABELS.map((a) => (
                <th key={a.key} className="px-2 py-3 text-center font-bold">
                  {a.label}
                  {a.key === "pronunciation" && (
                    <span className="ml-0.5 text-[var(--color-primary)]" title="시스템 자동">
                      ▸
                    </span>
                  )}
                </th>
              ))}
              <th className="px-3 py-3 text-center font-bold">평균</th>
              <th className="px-3 py-3 text-center font-bold">등급</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {students.map((s) => {
              const avg = average(s.scores);
              const g = grade(avg, cuts);
              return (
                <tr key={s.id} className="hover:bg-[var(--color-soft)]/40">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="font-semibold">{s.name}</span>{" "}
                    {s.code && <span className="text-xs text-[var(--color-muted)]">{s.code}</span>}
                  </td>
                  {AREA_LABELS.map((a) => (
                    <td key={a.key} className="px-2 py-2.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={s.scores[a.key] ?? ""}
                        onChange={(e) => onScore(s.id, a.key, e.target.value)}
                        className={`w-14 rounded-md border px-1.5 py-1 text-center text-sm tabular-nums outline-none focus:border-[var(--color-primary)] ${
                          a.key === "pronunciation"
                            ? "border-[var(--color-primary)]/40 bg-[var(--color-soft)]"
                            : "border-[var(--color-line)]"
                        }`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">{avg ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    {g ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRADE_META[g].tone}`}>
                        {GRADE_META[g].label}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        ▸ 발음은 시스템 자동 채점값(수정 가능) · 빈칸은 평균 계산에서 제외 · 평균·등급은 입력 즉시 갱신
      </p>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="brand-gradient rounded-full px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </>
  );
}

function ResultTab({
  roundId,
  ranked,
  rankMap,
  cuts,
}: {
  roundId: string;
  ranked: { s: RoundStudent; avg: number | null }[];
  rankMap: Map<string, number>;
  cuts: GradeCuts;
}) {
  const filled = ranked.filter((r) => r.avg !== null);
  const classAvg = filled.length
    ? Math.round((filled.reduce((a, r) => a + (r.avg ?? 0), 0) / filled.length) * 10) / 10
    : null;
  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
            <tr>
              <th className="px-3 py-3 text-center font-bold">순위</th>
              <th className="px-4 py-3 text-left font-bold">학생</th>
              {AREA_LABELS.map((a) => (
                <th key={a.key} className="px-2 py-3 text-center font-bold">
                  {a.short}
                </th>
              ))}
              <th className="px-3 py-3 text-center font-bold">총점</th>
              <th className="px-3 py-3 text-center font-bold">평균</th>
              <th className="px-3 py-3 text-center font-bold">등급</th>
              <th className="px-3 py-3 text-center font-bold">보고서</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {ranked.map(({ s, avg }) => {
              const g = grade(avg, cuts);
              return (
                <tr key={s.id} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">{rankMap.get(s.id)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{s.name}</td>
                  {AREA_LABELS.map((a) => (
                    <td key={a.key} className="px-2 py-2.5 text-center tabular-nums text-[var(--color-muted)]">
                      {s.scores[a.key] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center tabular-nums">{total(s.scores)}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">{avg ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    {g && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRADE_META[g].tone}`}>
                        {GRADE_META[g].dot} {GRADE_META[g].label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={`/admin/assessments/${roundId}/report/${s.id}`}
                      className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    >
                      보기
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        반 평균 {classAvg ?? "—"} · 동점은 공동 순위 · 코멘트는 “코멘트 일괄 생성” 후 보고서에서 확인·수정
      </p>
    </>
  );
}
