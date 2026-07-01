"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SKILLS, grade, GRADE_META, rankByTotal, type GradeCuts, type Skill } from "@/lib/exams/scoring";
import { confirmWriting, finalizeResult, generateComments } from "../../actions";

export type ResultRow = { studentId: string; name: string; code: string | null; status: string; total: number | null; average: number | null; comment: string; skills: Record<Skill, number | null> };
export type WritingAns = { answerId: string; studentId: string; prompt: string; maxPoints: number; text: string; aiScore: number | null; aiFeedback: string; teacherScore: number | null };
export type SpeakingAns = { studentId: string; prompt: string; audioUrl: string | null; transcript: string; awarded: number | null; feedback: string; status: string };

const STATUS_LABEL: Record<string, string> = { doing: "응시중", submitted: "제출됨", waiting_writing_review: "쓰기 검토대기", finalized: "확정" };

export function ResultsView({ testId, title, className, lessonRange, cuts, results, writing, speaking }: {
  testId: string; title: string; className: string; lessonRange: string | null; cuts: GradeCuts;
  results: ResultRow[]; writing: WritingAns[]; speaking: SpeakingAns[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [gen, startGen] = useTransition();

  const rankMap = rankByTotal(results.map((r) => ({ id: r.studentId, total: r.total })));

  function genComments() {
    setMsg(null);
    startGen(async () => { try { const r = await generateComments(testId); setMsg(`코멘트 ${r.count}명 생성`); router.refresh(); } catch { setMsg("코멘트 생성 실패"); } });
  }

  return (
    <div>
      <Link href={`/admin/exams/${testId}`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">← 출제 화면</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{className}{lessonRange ? ` · ${lessonRange}과` : ""} · 응시 {results.length}명</p>
        </div>
        <button onClick={genComments} disabled={gen} className="brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{gen ? "생성 중…" : "코멘트 일괄 생성"}</button>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-primary-deep)]">{msg}</p>}

      {results.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-muted)]">아직 응시한 학생이 없습니다.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-3 py-3 text-center font-bold">순위</th>
                <th className="px-4 py-3 text-left font-bold">학생</th>
                {SKILLS.map((s) => <th key={s.key} className="px-2 py-3 text-center font-bold">{s.label}</th>)}
                <th className="px-3 py-3 text-center font-bold">총점</th>
                <th className="px-3 py-3 text-center font-bold">평균</th>
                <th className="px-3 py-3 text-center font-bold">등급</th>
                <th className="px-3 py-3 text-center font-bold">상태</th>
                <th className="px-3 py-3 text-center font-bold">채점</th>
                <th className="px-3 py-3 text-center font-bold">보고서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {results.map((r) => {
                const g = grade(r.average, cuts);
                const expanded = open === r.studentId;
                return (
                  <Fragment key={r.studentId}>
                    <tr className="hover:bg-[var(--color-soft)]/40">
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">{rankMap.get(r.studentId)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{r.name}</td>
                      {SKILLS.map((s) => <td key={s.key} className="px-2 py-2.5 text-center tabular-nums text-[var(--color-muted)]">{r.skills[s.key] ?? "—"}</td>)}
                      <td className="px-3 py-2.5 text-center tabular-nums">{r.total ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">{r.average ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center">{g && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRADE_META[g].tone}`}>{GRADE_META[g].dot} {GRADE_META[g].label}</span>}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-[var(--color-muted)]">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="px-3 py-2.5 text-center"><button onClick={() => setOpen(expanded ? null : r.studentId)} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">{expanded ? "닫기" : "쓰기·말하기"}</button></td>
                      <td className="px-3 py-2.5 text-center"><Link href={`/admin/exams/${testId}/report/${r.studentId}`} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)]">보기</Link></td>
                    </tr>
                    {expanded && (
                      <tr><td colSpan={SKILLS.length + 6} className="bg-[var(--color-soft)]/30 px-4 py-3">
                        <Drilldown testId={testId} studentId={r.studentId} status={r.status}
                          writing={writing.filter((w) => w.studentId === r.studentId)} speaking={speaking.filter((s) => s.studentId === r.studentId)} />
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Drilldown({ testId, studentId, status, writing, speaking }: { testId: string; studentId: string; status: string; writing: WritingAns[]; speaking: SpeakingAns[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {writing.map((w) => <WritingGrade key={w.answerId} testId={testId} ans={w} />)}
      {speaking.map((s, i) => (
        <div key={i} className="rounded-lg border border-[var(--color-line)] bg-white p-3">
          <p className="text-xs font-bold text-[var(--color-muted)]">말하기 · {s.status === "graded" ? `${s.awarded ?? 0}점` : s.status}</p>
          <p className="mt-1 text-sm">{s.prompt}</p>
          {s.audioUrl && <audio controls src={s.audioUrl} className="mt-2 h-8 w-64" />}
          {s.feedback && <p className="mt-1 text-xs text-[var(--color-muted)]">{s.feedback}</p>}
        </div>
      ))}
      {writing.length === 0 && speaking.length === 0 && <p className="text-xs text-[var(--color-muted)]">쓰기 서술형·말하기 답안이 없습니다.</p>}
      {status !== "finalized" && (
        <button onClick={() => start(async () => { await finalizeResult(testId, studentId); router.refresh(); })} disabled={pending}
          className="brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60">
          {pending ? "확정 중…" : "최종 확정(쓰기 반영)"}
        </button>
      )}
    </div>
  );
}

function WritingGrade({ testId, ans }: { testId: string; ans: WritingAns }) {
  const router = useRouter();
  const [score, setScore] = useState(String(ans.teacherScore ?? ans.aiScore ?? ""));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-3">
      <p className="text-xs font-bold text-[var(--color-muted)]">쓰기 · {ans.maxPoints}점</p>
      <p className="mt-1 text-sm font-medium">{ans.prompt}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--color-soft)] p-2 text-sm">{ans.text || "(미작성)"}</p>
      {ans.aiFeedback && <p className="mt-1 text-xs text-[var(--color-muted)]">AI: {ans.aiFeedback}</p>}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted)]">AI 초안 {ans.aiScore ?? "—"} →</span>
        <input type="number" min={0} max={ans.maxPoints} value={score} onChange={(e) => setScore(e.target.value)} className="w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-center text-sm tabular-nums" />
        <span className="text-xs text-[var(--color-muted)]">점</span>
        <button onClick={() => start(async () => { await confirmWriting({ testId, answerId: ans.answerId, score: Number(score) || 0 }); setSaved(true); router.refresh(); })} disabled={pending} className="ml-auto rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)] disabled:opacity-60">{pending ? "저장 중…" : saved ? "저장됨" : "확정"}</button>
      </div>
    </div>
  );
}
