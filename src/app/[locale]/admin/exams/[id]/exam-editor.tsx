"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SKILLS, TYPES_FOR_SKILL, typeMeta, type QuestionType, type Skill } from "@/lib/exams/scoring";
import {
  addQuestion, addSection, deleteQuestion, deleteSection, deleteTest, regenerateTts, setPublished, updateQuestion,
} from "../actions";

export type EditorTest = { id: string; title: string; lessonRange: string | null; className: string; status: string };
export type EditorSection = { id: string; skill: Skill; title: string; maxScore: number };
export type EditorQuestion = {
  id: string; sectionId: string; skill: Skill; questionType: QuestionType;
  questionText: string; passageText: string; listeningScript: string;
  ttsStatus: string | null; audioUrl: string | null;
  options: { ko: string; vi: string }[]; correctAnswer: unknown; points: number; maxPlayCount: number;
};

const inp = "w-full rounded-md border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]";

export function TestEditor({ test, sections, questions }: { test: EditorTest; sections: EditorSection[]; questions: EditorQuestion[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const published = test.status === "published";
  const hasListening = questions.some((q) => q.skill === "listening" && q.listeningScript);

  function togglePublish() {
    setMsg(null);
    start(async () => {
      const r = await setPublished(test.id, !published);
      if (!r.ok) setMsg(r.error ?? "게시 불가");
      router.refresh();
    });
  }
  function removeTest() {
    if (!window.confirm("이 시험과 모든 문항·응시 기록을 삭제합니다. 계속할까요?")) return;
    start(async () => {
      try { await deleteTest(test.id); } catch (e) { if (e instanceof Error && e.message === "NEXT_REDIRECT") return; setMsg("삭제 실패"); }
    });
  }
  function genTts() {
    setMsg(null);
    start(async () => { await regenerateTts(test.id); setMsg("듣기 오디오 생성 요청됨 (잠시 후 새로고침)"); router.refresh(); });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/admin/exams" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]">← 주간 시험 목록</Link>
        <button onClick={removeTest} disabled={pending} className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50">시험 삭제</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {test.className}{test.lessonRange ? ` · ${test.lessonRange}과` : ""} ·{" "}
            <span className={published ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>{published ? "게시됨" : "작성중"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasListening && <button onClick={genTts} disabled={pending} className="rounded-full border border-[var(--color-line)] px-3 py-2 text-sm font-semibold hover:border-[var(--color-primary)] disabled:opacity-60">AI 오디오 생성</button>}
          <Link href={`/admin/exams/${test.id}/results`} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)]">응시 현황·채점</Link>
          <button onClick={togglePublish} disabled={pending} className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60 ${published ? "border border-[var(--color-line)]" : "brand-gradient text-white"}`}>{published ? "게시 취소" : "게시(학생 공개)"}</button>
        </div>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-primary-deep)]">{msg}</p>}

      <div className="mt-6 space-y-6">
        {SKILLS.map((s) => (
          <SkillPanel key={s.key} test={test} skill={s.key} label={s.label}
            sections={sections.filter((x) => x.skill === s.key)}
            questions={questions.filter((q) => q.skill === s.key)} />
        ))}
      </div>
    </div>
  );
}

function SkillPanel({ test, skill, label, sections, questions }: { test: EditorTest; skill: Skill; label: string; sections: EditorSection[]; questions: EditorQuestion[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [max, setMax] = useState("");
  const [pending, start] = useTransition();
  const total = questions.reduce((a, q) => a + q.points, 0);

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{label} <span className="text-xs font-normal text-[var(--color-muted)]">· 문항 배점 합 {total}점 (영역 100점 환산)</span></h2>
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-primary)]">{adding ? "닫기" : "섹션 추가"}</button>
      </div>
      {adding && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-[var(--color-line)] p-3">
          <label className="text-xs font-semibold text-[var(--color-muted)]">섹션 제목<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: I. 듣고 맞는 답 고르기" className={`${inp} mt-1 w-64`} /></label>
          <label className="text-xs font-semibold text-[var(--color-muted)]">배점<input type="number" value={max} onChange={(e) => setMax(e.target.value)} className={`${inp} mt-1 w-20`} /></label>
          <button disabled={pending} onClick={() => { if (!title.trim()) return; start(async () => { await addSection({ testId: test.id, skill, title: title.trim(), maxScore: Number(max) || 0 }); setTitle(""); setMax(""); setAdding(false); router.refresh(); }); }} className="brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60">추가</button>
        </div>
      )}
      <div className="mt-3 space-y-3">
        {sections.length === 0 && <p className="text-xs text-[var(--color-muted)]">섹션을 추가하고 문항을 입력하세요.</p>}
        {sections.map((sec) => (
          <SectionBlock key={sec.id} test={test} skill={skill} section={sec} questions={questions.filter((q) => q.sectionId === sec.id)} />
        ))}
      </div>
    </section>
  );
}

function SectionBlock({ test, skill, section, questions }: { test: EditorTest; skill: Skill; section: EditorSection; questions: EditorQuestion[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const pts = questions.reduce((a, q) => a + q.points, 0);

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{section.title} <span className="text-xs font-normal text-[var(--color-muted)]">· {questions.length}문항 · {pts}/{section.maxScore}점</span></p>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setAdding((v) => !v)} className="font-semibold text-[var(--color-primary)] hover:underline">{adding ? "닫기" : "문항 추가"}</button>
          <button onClick={() => { if (!window.confirm("섹션 삭제?")) return; start(async () => { await deleteSection(test.id, section.id); router.refresh(); }); }} disabled={pending} className="font-semibold text-red-500 hover:underline disabled:opacity-50">섹션삭제</button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {questions.map((q, i) => <QuestionRow key={q.id} test={test} skill={skill} section={section} question={q} index={i + 1} />)}
      </div>
      {adding && <div className="mt-2"><QuestionForm test={test} skill={skill} section={section} onDone={() => setAdding(false)} /></div>}
    </div>
  );
}

function QuestionRow({ test, skill, section, question, index }: { test: EditorTest; skill: Skill; section: EditorSection; question: EditorQuestion; index: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <div className="rounded-lg border border-[var(--color-primary)]/40 p-2"><QuestionForm test={test} skill={skill} section={section} initial={question} onDone={() => setEditing(false)} /></div>;
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-line)] p-2">
      <div className="min-w-0">
        <p className="text-sm"><span className="font-bold">{index}.</span> <span className="text-[10px] font-bold uppercase text-[var(--color-primary)]">{typeMeta(question.questionType).label}</span> {question.questionText || <span className="text-[var(--color-muted)]">(내용 없음)</span>} <span className="text-xs text-[var(--color-muted)]">· {question.points}점</span></p>
        {question.skill === "listening" && question.listeningScript && (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">🔊 {question.ttsStatus === "ready" ? "오디오 준비됨" : question.ttsStatus === "failed" ? "오디오 실패" : "오디오 생성대기"} {question.audioUrl && <audio controls src={question.audioUrl} className="mt-1 h-7 w-48 align-middle" />}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2 text-xs">
        <button onClick={() => setEditing(true)} className="font-semibold text-[var(--color-primary)] hover:underline">편집</button>
        <button onClick={() => { if (!window.confirm("문항 삭제?")) return; start(async () => { await deleteQuestion(test.id, question.id); router.refresh(); }); }} disabled={pending} className="font-semibold text-red-500 hover:underline disabled:opacity-50">삭제</button>
      </div>
    </div>
  );
}

function QuestionForm({ test, skill, section, initial, onDone }: { test: EditorTest; skill: Skill; section: EditorSection; initial?: EditorQuestion; onDone: () => void }) {
  const router = useRouter();
  const types = TYPES_FOR_SKILL[skill];
  const [qType, setQType] = useState<QuestionType>(initial?.questionType ?? types[0]);
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [passageText, setPassageText] = useState(initial?.passageText ?? "");
  const [listeningScript, setListeningScript] = useState(initial?.listeningScript ?? "");
  const [points, setPoints] = useState(String(initial?.points ?? 4));
  const [options, setOptions] = useState<{ ko: string; vi: string }[]>(
    initial?.options?.length ? initial.options : [{ ko: "", vi: "" }, { ko: "", vi: "" }]
  );
  const [answerIndex, setAnswerIndex] = useState<number>(typeof initial?.correctAnswer === "number" ? initial.correctAnswer : 0);
  const [oxAnswer, setOxAnswer] = useState<"O" | "X">(initial?.correctAnswer === "X" ? "X" : "O");
  const [textAnswer, setTextAnswer] = useState<string>(
    typeof initial?.correctAnswer === "string" ? initial.correctAnswer :
    Array.isArray(initial?.correctAnswer) ? (initial!.correctAnswer as string[]).join(", ") : ""
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isMcq = qType === "multiple_choice";
  const isOx = qType === "true_false";
  const isMatching = qType === "matching";
  const isFill = qType === "fill_blank";
  const isArrange = qType === "arrange_sentence";
  const isTranslation = qType === "translation";
  const showChoices = isMcq;

  function buildCorrect(): unknown {
    if (isMcq) return answerIndex;
    if (isOx) return oxAnswer;
    if (isMatching) return options.map((_, i) => i); // identity 매핑
    if (isFill) return textAnswer.split(",").map((s) => s.trim()).filter(Boolean);
    if (isArrange || isTranslation) return textAnswer.trim();
    return null;
  }

  function submit() {
    setErr(null);
    const opts = (isMcq || isMatching) ? options.filter((o) => o.ko.trim() || o.vi.trim()) : undefined;
    if (isMcq && (opts?.length ?? 0) < 2) { setErr("보기를 2개 이상 입력하세요."); return; }
    if (isMatching && (opts?.length ?? 0) < 2) { setErr("연결 쌍을 2개 이상 입력하세요."); return; }
    const payload = {
      testId: test.id, sectionId: section.id, skill, questionType: qType,
      questionText, passageText: passageText || undefined,
      listeningScript: skill === "listening" ? listeningScript || undefined : undefined,
      options: opts, correctAnswer: buildCorrect(), points: Number(points) || 0,
    };
    start(async () => {
      try {
        if (initial) await updateQuestion({ ...payload, questionId: initial.id });
        else await addQuestion(payload);
        onDone(); router.refresh();
      } catch { setErr("저장 실패"); }
    });
  }

  return (
    <div className="space-y-2 rounded-md bg-[var(--color-soft)]/40 p-2">
      {types.length > 1 && (
        <select value={qType} onChange={(e) => setQType(e.target.value as QuestionType)} className={`${inp} w-48`}>
          {types.map((t) => <option key={t} value={t}>{typeMeta(t).label}</option>)}
        </select>
      )}
      <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder={isOx ? "문장(O/X 판단 대상)" : isArrange ? "제시 단어(예: 사람이에요 / 저는 / 베트남)" : isTranslation ? "베트남어 문장" : "문제/지시문"} className={inp} />

      {skill === "reading" && <textarea value={passageText} onChange={(e) => setPassageText(e.target.value)} rows={2} placeholder="지문(선택)" className={inp} />}

      {skill === "listening" && (
        <textarea value={listeningScript} onChange={(e) => setListeningScript(e.target.value)} rows={2} placeholder="듣기 원문(AI 음성 생성용, 학생 비표시)" className={inp} />
      )}

      {showChoices && (
        <div className="space-y-1">
          {options.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`ans-${initial?.id ?? "new"}`} checked={answerIndex === i} onChange={() => setAnswerIndex(i)} title="정답" />
              <input value={c.ko} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} placeholder={`보기 ${i + 1}`} className={inp} />
              {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-xs text-red-500">✕</button>}
            </div>
          ))}
          {options.length < 6 && <button onClick={() => setOptions([...options, { ko: "", vi: "" }])} className="text-xs font-semibold text-[var(--color-primary)]">+ 보기 추가</button>}
        </div>
      )}

      {isOx && (
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={oxAnswer === "O"} onChange={() => setOxAnswer("O")} /> O (맞음)</label>
          <label className="flex items-center gap-1"><input type="radio" checked={oxAnswer === "X"} onChange={() => setOxAnswer("X")} /> X (틀림)</label>
        </div>
      )}

      {isMatching && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-muted)]">연결 쌍 (한국어 ↔ 뜻). 정답은 같은 행끼리 자동 매칭.</p>
          {options.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c.ko} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} placeholder={`한국어 ${i + 1}`} className={inp} />
              <span className="text-xs">↔</span>
              <input value={c.vi} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, vi: e.target.value } : x))} placeholder={`뜻 ${i + 1}`} className={inp} />
              {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-xs text-red-500">✕</button>}
            </div>
          ))}
          {options.length < 6 && <button onClick={() => setOptions([...options, { ko: "", vi: "" }])} className="text-xs font-semibold text-[var(--color-primary)]">+ 쌍 추가</button>}
        </div>
      )}

      {isFill && <input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="정답(여러 개는 쉼표: 이에요, 예요)" className={inp} />}
      {(isArrange || isTranslation) && <input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder={isArrange ? "정답 문장" : "참고 정답(한국어, AI 채점용)"} className={inp} />}

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[var(--color-muted)]">배점<input type="number" min={0} max={100} value={points} onChange={(e) => setPoints(e.target.value)} className={`ml-1 w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-center text-sm tabular-nums outline-none`} /></label>
        {err && <span className="text-xs text-red-600">{err}</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onDone} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold">취소</button>
          <button onClick={submit} disabled={pending} className="brand-gradient rounded-full px-4 py-1 text-xs font-bold text-white disabled:opacity-60">{pending ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}
