"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { SKILL_LABEL, type QuestionType, type Skill } from "@/lib/exams/scoring";
import { saveArea, submitTest } from "../../actions";
import { AudioRecorder } from "../../../assignments/[id]/audio-recorder";

export type RunnerSection = { id: string; title: string };
export type RunnerQuestion = {
  id: string; sectionId: string; questionType: QuestionType; questionText: string; passageText: string;
  audioUrl: string | null; options: { ko: string; vi: string }[]; points: number; maxPlayCount: number;
  savedOption: unknown; savedText: string; answered: boolean;
};

export function AreaRunner({ testId, testTitle, skill, stepIndex, stepTotal, nextSkill, sections, questions }: {
  testId: string; testTitle: string; skill: Skill; stepIndex: number; stepTotal: number;
  nextSkill: Skill | null; sections: RunnerSection[]; questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, unknown>>(
    Object.fromEntries(questions.filter((q) => q.savedOption !== null).map((q) => [q.id, q.savedOption]))
  );
  const [text, setText] = useState<Record<string, string>>(Object.fromEntries(questions.map((q) => [q.id, q.savedText])));
  const [recorded, setRecorded] = useState<Record<string, boolean>>(Object.fromEntries(questions.filter((q) => q.answered).map((q) => [q.id, true])));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isSpeaking = skill === "speaking";

  async function uploadSpeaking(qid: string, blob: Blob) {
    const res = await fetch(`/api/student/exam-speaking?testId=${testId}&questionId=${qid}`, {
      method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob,
    });
    if (!res.ok) throw new Error("upload failed");
    setRecorded((r) => ({ ...r, [qid]: true }));
  }

  function collect() {
    return questions.map((q) => {
      const t = q.questionType;
      if (t === "multiple_choice" || t === "true_false" || t === "matching")
        return { questionId: q.id, selectedOption: sel[q.id] ?? null };
      return { questionId: q.id, answerText: text[q.id] ?? "" };
    }).filter((a) => a.questionId);
  }

  function advance() {
    setErr(null);
    start(async () => {
      try {
        if (!isSpeaking) await saveArea({ testId, skill, answers: collect() });
        if (nextSkill) router.push(`/student/exams/${testId}/${nextSkill}`);
        else { await submitTest(testId); router.push(`/student/exams/${testId}/result`); }
      } catch { setErr("저장에 실패했습니다."); }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <p className="text-xs font-semibold text-[var(--color-muted)]">{testTitle}</p>
      <h1 className="mt-1 text-xl font-bold">{SKILL_LABEL[skill]} <span className="text-sm font-normal text-[var(--color-muted)]">({stepIndex + 1}/{stepTotal})</span></h1>
      <div className="mt-2 flex gap-1">{Array.from({ length: stepTotal }).map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "brand-gradient" : "bg-[var(--color-line)]"}`} />)}</div>

      <div className="mt-5 space-y-6">
        {sections.map((sec) => {
          const secQs = questions.filter((q) => q.sectionId === sec.id);
          if (!secQs.length) return null;
          return (
            <section key={sec.id}>
              <p className="mb-2 text-sm font-bold text-[var(--color-primary-deep)]">{sec.title}</p>
              <div className="space-y-4">
                {secQs.map((q, qi) => (
                  <QuestionCard key={q.id} q={q} index={qi + 1} sel={sel[q.id]} text={text[q.id] ?? ""} recorded={!!recorded[q.id]}
                    onSel={(v) => setSel((s) => ({ ...s, [q.id]: v }))} onText={(v) => setText((s) => ({ ...s, [q.id]: v }))}
                    onRecord={(blob) => uploadSpeaking(q.id, blob)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
      <div className="mt-6 flex justify-end">
        <button onClick={advance} disabled={pending} className="brand-gradient rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
          {pending ? "처리 중…" : nextSkill ? "다음 영역 →" : "시험 제출하기"}
        </button>
      </div>
    </div>
  );
}

function AudioPlayer({ url, max }: { url: string; max: number }) {
  const [plays, setPlays] = useState(0);
  const done = plays >= max;
  return (
    <div className="mt-2">
      {!done ? (
        <audio controls src={url} onPlay={() => setPlays((p) => p + 1)} className="w-full" />
      ) : (
        <p className="text-xs text-[var(--color-muted)]">재생 횟수({max}회)를 모두 사용했습니다.</p>
      )}
      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">재생 {plays}/{max}회</p>
    </div>
  );
}

function QuestionCard({ q, index, sel, text, recorded, onSel, onText, onRecord }: {
  q: RunnerQuestion; index: number; sel: unknown; text: string; recorded: boolean;
  onSel: (v: unknown) => void; onText: (v: string) => void; onRecord: (blob: Blob) => Promise<void>;
}) {
  const t = q.questionType;
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
      {q.passageText && <p className="mb-2 whitespace-pre-wrap rounded-lg bg-[var(--color-soft)] p-3 text-sm leading-relaxed">{q.passageText}</p>}
      <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">{index}. {q.questionText}<span className="ml-1 text-xs font-normal text-[var(--color-muted)]">({q.points}점)</span></p>

      {q.audioUrl && <AudioPlayer url={q.audioUrl} max={q.maxPlayCount} />}

      {t === "multiple_choice" && (
        <div className="mt-3 space-y-2">
          {q.options.map((c, ci) => (
            <button key={ci} onClick={() => onSel(ci)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${sel === ci ? "border-[var(--color-primary)] bg-[var(--color-soft)] font-semibold" : "border-[var(--color-line)] hover:border-[var(--color-ink)]"}`}>{c.ko}{c.vi && <span className="ml-1 text-xs text-[var(--color-muted)]">({c.vi})</span>}</button>
          ))}
        </div>
      )}

      {t === "true_false" && (
        <div className="mt-3 flex gap-2">
          {(["O", "X"] as const).map((v) => (
            <button key={v} onClick={() => onSel(v)} className={`rounded-lg border px-6 py-2 text-sm font-bold ${sel === v ? "border-[var(--color-primary)] bg-[var(--color-soft)]" : "border-[var(--color-line)] hover:border-[var(--color-ink)]"}`}>{v}</button>
          ))}
        </div>
      )}

      {t === "matching" && (
        <div className="mt-3 space-y-2">
          {q.options.map((c, i) => {
            const arr = Array.isArray(sel) ? (sel as number[]) : [];
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 font-medium">{c.ko}</span>
                <span>↔</span>
                <select value={arr[i] ?? ""} onChange={(e) => { const next = [...arr]; next[i] = Number(e.target.value); onSel(next); }} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-sm">
                  <option value="">선택</option>
                  {q.options.map((o, j) => <option key={j} value={j}>{o.vi}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {(t === "fill_blank" || t === "arrange_sentence" || t === "translation") && (
        <input value={text} onChange={(e) => onText(e.target.value)} placeholder="답 입력" className="mt-3 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]" />
      )}

      {t === "short_writing" && (
        <textarea value={text} onChange={(e) => onText(e.target.value)} rows={4} placeholder="답안을 작성하세요" className="mt-3 w-full rounded-lg border border-[var(--color-line)] p-3 text-sm outline-none focus:border-[var(--color-primary)]" />
      )}

      {t === "speaking_recording" && (
        <div className="mt-3">{recorded ? <p className="text-sm font-semibold text-emerald-600">✓ 녹음 제출됨 (자동 채점 중)</p> : <AudioRecorder maxDurationSec={60} onSubmit={(blob) => onRecord(blob)} />}</div>
      )}
    </div>
  );
}
