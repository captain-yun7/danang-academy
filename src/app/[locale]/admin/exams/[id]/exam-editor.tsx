"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SECTIONS, weightsTotal, type ExamWeights, type Section } from "@/lib/exams/scoring";
import {
  addQuestion,
  deleteExam,
  deleteQuestion,
  setPublished,
  updatePassage,
  updateQuestion,
  updateWeights,
} from "../actions";

export type EditorExam = {
  id: string;
  title: string;
  className: string;
  date: string;
  status: string;
  weights: ExamWeights;
  passageKo: string;
  passageVi: string;
};

export type EditorQuestion = {
  id: string;
  section: Section;
  promptKo: string;
  promptVi: string;
  choices: { ko: string; vi: string }[];
  answerIndex: number | null;
  points: number;
  audioKey: string | null;
  audioUrl: string | null;
};

export function ExamEditor({ exam, questions }: { exam: EditorExam; questions: EditorQuestion[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const published = exam.status === "published";

  function togglePublish() {
    setMsg(null);
    start(async () => {
      const res = await setPublished(exam.id, !published);
      if (!res.ok) setMsg(res.error ?? "게시할 수 없습니다.");
      router.refresh();
    });
  }

  function removeExam() {
    if (!window.confirm("이 시험과 모든 문항·응시 기록을 삭제합니다. 계속할까요?")) return;
    start(async () => {
      try {
        await deleteExam(exam.id);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        setMsg("삭제 실패");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/admin/exams" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          ← 온라인 시험 목록
        </Link>
        <button onClick={removeExam} disabled={pending} className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50">
          시험 삭제
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {exam.className} · {exam.date} ·{" "}
            <span className={published ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
              {published ? "게시됨" : "작성중"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/exams/${exam.id}/results`}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            응시 현황·채점
          </Link>
          <button
            onClick={togglePublish}
            disabled={pending}
            className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60 ${
              published
                ? "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
                : "brand-gradient text-white"
            }`}
          >
            {published ? "게시 취소" : "게시(학생 공개)"}
          </button>
        </div>
      </div>

      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}

      <WeightsEditor exam={exam} />

      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <SectionPanel
            key={s.key}
            exam={exam}
            section={s.key}
            label={s.label}
            mcq={s.mcq}
            questions={questions.filter((q) => q.section === s.key)}
          />
        ))}
      </div>
    </div>
  );
}

function WeightsEditor({ exam }: { exam: EditorExam }) {
  const router = useRouter();
  const [w, setW] = useState<ExamWeights>(exam.weights);
  const [pending, start] = useTransition();
  const total = weightsTotal(w);

  function save() {
    start(async () => {
      await updateWeights({ examId: exam.id, ...w });
      router.refresh();
    });
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-white p-4">
      <p className="text-sm font-bold">섹션 배점 (합계 100)</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {SECTIONS.map((s) => (
          <label key={s.key} className="block">
            <span className="text-xs font-semibold text-[var(--color-muted)]">{s.label}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={w[s.weightKey]}
              onChange={(e) => setW({ ...w, [s.weightKey]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              className="mt-1 block w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-[var(--color-primary)]"
            />
          </label>
        ))}
        <span className={`text-sm font-bold ${total === 100 ? "text-emerald-600" : "text-red-600"}`}>합 {total}</span>
        <button
          onClick={save}
          disabled={pending}
          className="ml-auto rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-60"
        >
          배점 저장
        </button>
      </div>
    </div>
  );
}

function SectionPanel({
  exam,
  section,
  label,
  mcq,
  questions,
}: {
  exam: EditorExam;
  section: Section;
  label: string;
  mcq: boolean;
  questions: EditorQuestion[];
}) {
  const [adding, setAdding] = useState(false);
  const pts = questions.reduce((a, q) => a + q.points, 0);

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">
          {label} <span className="text-xs font-normal text-[var(--color-muted)]">· {questions.length}문항 · {pts}점</span>
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          {adding ? "닫기" : "문항 추가"}
        </button>
      </div>

      {section === "reading" && <PassageEditor exam={exam} />}

      <div className="mt-3 space-y-2">
        {questions.map((q, i) => (
          <QuestionRow key={q.id} exam={exam} section={section} mcq={mcq} question={q} index={i + 1} />
        ))}
        {questions.length === 0 && !adding && (
          <p className="text-xs text-[var(--color-muted)]">아직 문항이 없습니다.</p>
        )}
      </div>

      {adding && (
        <div className="mt-3">
          <QuestionForm exam={exam} section={section} mcq={mcq} onDone={() => setAdding(false)} />
        </div>
      )}
    </section>
  );
}

function PassageEditor({ exam }: { exam: EditorExam }) {
  const router = useRouter();
  const [ko, setKo] = useState(exam.passageKo);
  const [vi, setVi] = useState(exam.passageVi);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 rounded-lg border border-dashed border-[var(--color-line)] p-3">
      <p className="text-xs font-bold text-[var(--color-muted)]">읽기 지문 (5문항 공통)</p>
      <textarea
        value={ko}
        onChange={(e) => setKo(e.target.value)}
        rows={3}
        placeholder="한국어 지문"
        className="mt-2 w-full rounded-md border border-[var(--color-line)] p-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      <textarea
        value={vi}
        onChange={(e) => setVi(e.target.value)}
        rows={2}
        placeholder="Đoạn văn tiếng Việt (선택)"
        className="mt-2 w-full rounded-md border border-[var(--color-line)] p-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      <button
        onClick={() => start(async () => { await updatePassage({ examId: exam.id, ko, vi }); router.refresh(); })}
        disabled={pending}
        className="mt-2 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)] disabled:opacity-60"
      >
        지문 저장
      </button>
    </div>
  );
}

function QuestionRow({
  exam,
  section,
  mcq,
  question,
  index,
}: {
  exam: EditorExam;
  section: Section;
  mcq: boolean;
  question: EditorQuestion;
  index: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="rounded-lg border border-[var(--color-primary)]/40 p-3">
        <QuestionForm exam={exam} section={section} mcq={mcq} initial={question} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-line)] p-3">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-bold">{index}.</span> {question.promptKo || <span className="text-[var(--color-muted)]">(지시문 없음)</span>}
          <span className="ml-1 text-xs text-[var(--color-muted)]">· {question.points}점</span>
        </p>
        {mcq && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {question.choices.map((c, i) => (
              <li key={i} className={i === question.answerIndex ? "font-bold text-emerald-700" : "text-[var(--color-muted)]"}>
                {i === question.answerIndex ? "✓ " : "· "}
                {c.ko}
              </li>
            ))}
          </ul>
        )}
        {question.audioUrl && <audio controls src={question.audioUrl} className="mt-1 h-8 w-56" />}
      </div>
      <div className="flex shrink-0 gap-2 text-xs">
        <button onClick={() => setEditing(true)} className="font-semibold text-[var(--color-primary)] hover:underline">
          편집
        </button>
        <button
          onClick={() => {
            if (!window.confirm("이 문항을 삭제할까요?")) return;
            start(async () => { await deleteQuestion(exam.id, question.id); router.refresh(); });
          }}
          disabled={pending}
          className="font-semibold text-red-500 hover:underline disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function QuestionForm({
  exam,
  section,
  mcq,
  initial,
  onDone,
}: {
  exam: EditorExam;
  section: Section;
  mcq: boolean;
  initial?: EditorQuestion;
  onDone: () => void;
}) {
  const router = useRouter();
  const [promptKo, setPromptKo] = useState(initial?.promptKo ?? "");
  const [promptVi, setPromptVi] = useState(initial?.promptVi ?? "");
  const [choices, setChoices] = useState<{ ko: string; vi: string }[]>(
    initial?.choices?.length ? initial.choices : [{ ko: "", vi: "" }, { ko: "", vi: "" }]
  );
  const [answerIndex, setAnswerIndex] = useState(initial?.answerIndex ?? 0);
  const [points, setPoints] = useState(String(initial?.points ?? (section === "grammar_vocab" ? 3 : 4)));
  const [audioKey, setAudioKey] = useState<string | null>(initial?.audioKey ?? null);
  const [audioPreview, setAudioPreview] = useState<string | null>(initial?.audioUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function uploadAudio(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/exam-audio?examId=${exam.id}`, {
        method: "POST",
        headers: { "content-type": file.type || "audio/mpeg" },
        body: file,
      });
      const data = (await res.json()) as { ok?: boolean; key?: string; error?: string };
      if (!data.ok || !data.key) throw new Error(data.error ?? "upload failed");
      setAudioKey(data.key);
      setAudioPreview(URL.createObjectURL(file));
    } catch {
      setErr("음성 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setErr(null);
    const payload = {
      examId: exam.id,
      section,
      promptKo,
      promptVi,
      choices: mcq ? choices.filter((c) => c.ko.trim()) : undefined,
      answerIndex: mcq ? answerIndex : null,
      points: Number(points) || 0,
      audioKey: audioKey ?? undefined,
    };
    if (mcq && payload.choices!.length < 2) {
      setErr("보기를 2개 이상 입력하세요.");
      return;
    }
    start(async () => {
      try {
        if (initial) await updateQuestion({ ...payload, questionId: initial.id });
        else await addQuestion(payload);
        onDone();
        router.refresh();
      } catch {
        setErr("저장 실패");
      }
    });
  }

  const inp =
    "w-full rounded-md border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]";

  return (
    <div className="space-y-2">
      <input value={promptKo} onChange={(e) => setPromptKo(e.target.value)} placeholder={mcq ? "문제(한국어)" : "지시문(한국어)"} className={inp} />
      <input value={promptVi} onChange={(e) => setPromptVi(e.target.value)} placeholder="Tiếng Việt (선택)" className={inp} />

      {section === "listening" && (
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])}
            className="text-xs"
          />
          {uploading && <span className="text-xs text-[var(--color-muted)]">업로드 중…</span>}
          {audioPreview && <audio controls src={audioPreview} className="h-8 w-48" />}
        </div>
      )}

      {mcq && (
        <div className="space-y-1.5">
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`ans-${initial?.id ?? "new"}-${section}`}
                checked={answerIndex === i}
                onChange={() => setAnswerIndex(i)}
                title="정답"
              />
              <input
                value={c.ko}
                onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, ko: e.target.value } : x)))}
                placeholder={`보기 ${i + 1}`}
                className={inp}
              />
              {choices.length > 2 && (
                <button onClick={() => setChoices(choices.filter((_, j) => j !== i))} className="text-xs text-red-500">
                  ✕
                </button>
              )}
            </div>
          ))}
          {choices.length < 4 && (
            <button onClick={() => setChoices([...choices, { ko: "", vi: "" }])} className="text-xs font-semibold text-[var(--color-primary)]">
              + 보기 추가
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[var(--color-muted)]">
          배점
          <input type="number" min={0} max={100} value={points} onChange={(e) => setPoints(e.target.value)} className="ml-1 w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-[var(--color-primary)]" />
        </label>
        {err && <span className="text-xs text-red-600">{err}</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onDone} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold">
            취소
          </button>
          <button onClick={submit} disabled={pending} className="brand-gradient rounded-full px-4 py-1 text-xs font-bold text-white disabled:opacity-60">
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
