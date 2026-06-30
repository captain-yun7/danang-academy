"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { SECTION_LABEL, type Section } from "@/lib/exams/scoring";
import { saveSection, submitExam } from "../../actions";
import { AudioRecorder } from "../../../assignments/[id]/audio-recorder";

export type RunnerQuestion = {
  id: string;
  promptKo: string;
  promptVi: string;
  choices: { ko: string; vi: string }[];
  points: number;
  audioUrl: string | null;
  savedChoice: number | null;
  savedText: string;
  answerStatus: string | null;
};

const MCQ_SECTIONS: Section[] = ["listening", "reading", "grammar_vocab"];

export function SectionRunner({
  examId,
  examTitle,
  section,
  stepIndex,
  stepTotal,
  nextSection,
  passageKo,
  passageVi,
  questions,
}: {
  examId: string;
  examTitle: string;
  section: Section;
  stepIndex: number;
  stepTotal: number;
  nextSection: Section | null;
  passageKo: string | null;
  passageVi: string | null;
  questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const isMcq = MCQ_SECTIONS.includes(section);
  const isWriting = section === "writing";
  const isSpeaking = section === "speaking";

  const [mcq, setMcq] = useState<Record<string, number>>(
    Object.fromEntries(questions.filter((q) => q.savedChoice !== null).map((q) => [q.id, q.savedChoice as number]))
  );
  const [writing, setWriting] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((q) => [q.id, q.savedText]))
  );
  const [recorded, setRecorded] = useState<Record<string, boolean>>(
    Object.fromEntries(questions.filter((q) => q.answerStatus).map((q) => [q.id, true]))
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function uploadSpeaking(questionId: string, blob: Blob) {
    const res = await fetch(`/api/student/exam-speaking?examId=${examId}&questionId=${questionId}`, {
      method: "POST",
      headers: { "content-type": blob.type || "audio/webm" },
      body: blob,
    });
    if (!res.ok) throw new Error("upload failed");
    setRecorded((r) => ({ ...r, [questionId]: true }));
  }

  function goNext() {
    setErr(null);
    start(async () => {
      try {
        if (isMcq) {
          await saveSection({
            examId,
            section,
            answers: questions.map((q) => ({ questionId: q.id, choiceIndex: mcq[q.id] ?? null })),
          });
        } else if (isWriting) {
          await saveSection({
            examId,
            section,
            answers: questions.map((q) => ({ questionId: q.id, text: writing[q.id] ?? "" })),
          });
        }
        if (nextSection) router.push(`/student/exams/${examId}/${nextSection}`);
      } catch {
        setErr("저장에 실패했습니다. 다시 시도하세요.");
      }
    });
  }

  function finish() {
    setErr(null);
    start(async () => {
      try {
        await submitExam(examId);
        router.push(`/student/exams/${examId}/result`);
      } catch {
        setErr("제출에 실패했습니다.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <p className="text-xs font-semibold text-[var(--color-muted)]">{examTitle}</p>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {SECTION_LABEL[section]} <span className="text-sm font-normal text-[var(--color-muted)]">({stepIndex + 1}/{stepTotal})</span>
        </h1>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: stepTotal }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "brand-gradient" : "bg-[var(--color-line)]"}`} />
        ))}
      </div>

      {section === "reading" && passageKo && (
        <section className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-soft)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">지문</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{passageKo}</p>
          {passageVi && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-muted)]">{passageVi}</p>}
        </section>
      )}

      {questions.length === 0 && (
        <p className="mt-6 text-sm text-[var(--color-muted)]">이 영역에는 문항이 없습니다.</p>
      )}

      <div className="mt-5 space-y-4">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
            <p className="text-sm font-semibold">
              {qi + 1}. {q.promptKo}
              <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">({q.points}점)</span>
            </p>
            {q.promptVi && <p className="text-xs text-[var(--color-muted)]">{q.promptVi}</p>}

            {section === "listening" && q.audioUrl && <audio controls src={q.audioUrl} className="mt-2 w-full" />}

            {isMcq && (
              <div className="mt-3 space-y-2">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setMcq((m) => ({ ...m, [q.id]: ci }))}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      mcq[q.id] === ci
                        ? "border-[var(--color-primary)] bg-[var(--color-soft)] font-semibold"
                        : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                    }`}
                  >
                    {c.ko}
                    {c.vi && <span className="ml-1 text-xs text-[var(--color-muted)]">({c.vi})</span>}
                  </button>
                ))}
              </div>
            )}

            {isWriting && (
              <textarea
                value={writing[q.id] ?? ""}
                onChange={(e) => setWriting((w) => ({ ...w, [q.id]: e.target.value }))}
                rows={5}
                placeholder="답안을 작성하세요"
                className="mt-3 w-full rounded-lg border border-[var(--color-line)] p-3 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            )}

            {isSpeaking && (
              <div className="mt-3">
                {recorded[q.id] ? (
                  <p className="text-sm font-semibold text-emerald-600">✓ 녹음 제출됨 (자동 채점 중)</p>
                ) : (
                  <AudioRecorder maxDurationSec={60} onSubmit={(blob) => uploadSpeaking(q.id, blob)} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <div className="mt-6 flex justify-end">
        {isSpeaking ? (
          <button
            onClick={finish}
            disabled={pending}
            className="brand-gradient rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "제출 중…" : "시험 제출하기"}
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={pending}
            className="brand-gradient rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "저장 중…" : "다음 영역 →"}
          </button>
        )}
      </div>
    </div>
  );
}
