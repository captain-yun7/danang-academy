"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createAssignment, updateAssignment, generateAssignmentSteps } from "./actions";

type Klass = { id: string; name: string };
type Student = { id: string; name: string; studentCode: string | null; className: string | null };
type TargetType = "all" | "class" | "students";
type AssignmentType = "pronunciation" | "writing" | "listening";
type ListStepType = "word" | "phrase" | "sentence";

export type StepsInitial = {
  word: string[];
  phrase: string[];
  sentence: string[];
  passage: string;
};

type Initial = {
  id: string;
  type: AssignmentType;
  targetType: TargetType;
  classId: string | null;
  studentIds: string[];
  title: string;
  instructions: string | null;
  targetText: string | null;
  dueDate: string | null;
  steps?: StepsInitial | null;
};

const LIST_STEPS: ListStepType[] = ["word", "phrase", "sentence"];

export function AssignmentForm({
  mode,
  classes,
  students,
  initial,
}: {
  mode: "create" | "edit";
  classes: Klass[];
  students: Student[];
  initial?: Initial;
}) {
  const t = useTranslations("admin.assignments.form");
  const tType = useTranslations("admin.assignments.types");
  const tSteps = useTranslations("admin.assignments.steps");
  const [pending, startTransition] = useTransition();
  const [generating, startGenerating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<AssignmentType>(initial?.type ?? "pronunciation");
  const [targetType, setTargetType] = useState<TargetType>(initial?.targetType ?? "all");
  const [classId, setClassId] = useState(initial?.classId ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.studentIds ?? []));
  const [stepMode, setStepMode] = useState(!!initial?.steps);
  const [lists, setLists] = useState<Record<ListStepType, string[]>>({
    word: initial?.steps?.word.length ? initial.steps.word : [""],
    phrase: initial?.steps?.phrase.length ? initial.steps.phrase : [""],
    sentence: initial?.steps?.sentence.length ? initial.steps.sentence : [""],
  });
  const [passage, setPassage] = useState(initial?.steps?.passage ?? "");
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  function toggle(id: string) {
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setItem(st: ListStepType, i: number, value: string) {
    setLists((prev) => ({ ...prev, [st]: prev[st].map((v, j) => (j === i ? value : v)) }));
  }

  function addItem(st: ListStepType) {
    setLists((prev) =>
      prev[st].length >= 15 ? prev : { ...prev, [st]: [...prev[st], ""] }
    );
  }

  function removeItem(st: ListStepType, i: number) {
    setLists((prev) => {
      const next = prev[st].filter((_, j) => j !== i);
      return { ...prev, [st]: next.length ? next : [""] };
    });
  }

  function generateSteps() {
    setError(null);
    const src = sourceRef.current?.value.trim() ?? "";
    if (src.length < 10) {
      setError(t("errors.needSource"));
      return;
    }
    startGenerating(async () => {
      try {
        const g = await generateAssignmentSteps(src);
        // 서버 검증 한도(단계당 15개, 항목 200자, 발화문 600자)에 맞춰 절단
        const clamp = (arr: string[]) => arr.slice(0, 15).map((v) => v.slice(0, 200));
        setLists({
          word: clamp(g.words),
          phrase: clamp(g.phrases),
          sentence: clamp(g.sentences),
        });
        setPassage(g.passage.slice(0, 600));
      } catch {
        setError(t("errors.generateFailed"));
      }
    });
  }

  const isStepPron = type === "pronunciation" && stepMode;
  const targetLabel =
    type === "writing"
      ? t("targetWriting")
      : type === "listening"
        ? t("targetListening")
        : isStepPron
          ? t("sourceText")
          : t("targetPronunciation");
  const targetPlaceholder =
    type === "writing"
      ? t("targetWritingPlaceholder")
      : type === "listening"
        ? t("targetListeningPlaceholder")
        : isStepPron
          ? t("sourceTextPlaceholder")
          : t("targetPronunciationPlaceholder");

  return (
    <form
      onChange={() => saved && setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const fd = new FormData(e.currentTarget);

        let steps:
          | { stepType: ListStepType | "passage"; items: string[] }[]
          | undefined;
        if (isStepPron) {
          const listSteps = LIST_STEPS.map((st) => ({
            stepType: st,
            items: lists[st].map((v) => v.trim()).filter(Boolean),
          }));
          const passageText = passage.trim();
          steps = [
            ...listSteps,
            { stepType: "passage" as const, items: passageText ? [passageText] : [] },
          ];
          if (steps.some((s) => s.items.length === 0)) {
            setError(t("errors.needStepItems"));
            return;
          }
        }

        const payload = {
          type,
          targetType,
          classId: targetType === "class" ? classId : "",
          studentIds: targetType === "students" ? Array.from(picked) : [],
          title: String(fd.get("title") ?? ""),
          instructions: String(fd.get("instructions") ?? ""),
          targetText: String(fd.get("targetText") ?? ""),
          dueDate: String(fd.get("dueDate") ?? ""),
          steps,
        };
        if (targetType === "class" && !classId) {
          setError(t("errors.needClass"));
          return;
        }
        if (targetType === "students" && picked.size === 0) {
          setError(t("errors.needStudents"));
          return;
        }
        startTransition(async () => {
          try {
            if (mode === "create") await createAssignment(payload);
            else if (initial) {
              await updateAssignment({ ...payload, id: initial.id });
              setSaved(true);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "error";
            setError(msg === "invalid_input" ? t("errors.invalidInput") : t("errors.generic"));
          }
        });
      }}
      className="grid gap-4"
    >
      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-xs font-semibold">{t("type")}</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AssignmentType)}
          disabled={mode === "edit"}
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-soft)]"
        >
          <option value="pronunciation">{tType("pronunciation")}</option>
          <option value="writing">{tType("writing")}</option>
          <option value="listening">{tType("listening")}</option>
        </select>
      </label>

      {/* 배정 대상 */}
      <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
        <legend className="px-2 text-xs font-semibold">{t("target")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "class", "students"] as const).map((mode2) => (
            <button
              key={mode2}
              type="button"
              onClick={() => {
                setTargetType(mode2);
                setSaved(false);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                targetType === mode2
                  ? "brand-gradient text-white"
                  : "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              {t(`targets.${mode2}`)}
            </button>
          ))}
        </div>

        {targetType === "class" && (
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSaved(false);
            }}
            className="mt-3 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] sm:max-w-sm"
          >
            <option value="">{t("selectClass")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {targetType === "students" && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] text-[var(--color-muted)]">
              {t("pickedCount", { count: picked.size })}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-line)]">
              {students.length === 0 ? (
                <p className="p-4 text-xs text-[var(--color-muted)]">{t("noStudents")}</p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {students.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--color-soft)]/50">
                        <input
                          type="checkbox"
                          checked={picked.has(s.id)}
                          onChange={() => toggle(s.id)}
                        />
                        {s.studentCode && (
                          <span className="rounded bg-[var(--color-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                            {s.studentCode}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{s.name}</span>
                        {s.className && (
                          <span className="ml-auto text-[11px] text-[var(--color-muted)]">
                            {s.className}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {t("titleField")} <span className="text-red-500">*</span>
        </span>
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={initial?.title ?? ""}
          placeholder={t("titlePlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      {type === "pronunciation" && (
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={stepMode}
            onChange={(e) => {
              setStepMode(e.target.checked);
              setSaved(false);
            }}
          />
          <span className="text-xs font-semibold">{t("stepMode")}</span>
          <span className="text-[11px] text-[var(--color-muted)]">{t("stepModeHint")}</span>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          {targetLabel} <span className="text-red-500">*</span>
        </span>
        <textarea
          name="targetText"
          ref={sourceRef}
          required
          maxLength={2000}
          rows={type === "writing" ? 3 : 5}
          defaultValue={initial?.targetText ?? ""}
          placeholder={targetPlaceholder}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        {(type === "listening" || (type === "pronunciation" && !stepMode)) && (
          <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{t("ttsHint")}</span>
        )}
        {isStepPron && (
          <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
            {t("sourceHint")}
          </span>
        )}
      </label>

      {/* 4단계 편집기 */}
      {isStepPron && (
        <fieldset className="grid gap-5 rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-2 text-xs font-semibold">{t("stepsEditorTitle")}</legend>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={generating}
              onClick={generateSteps}
              className="rounded-full border-2 border-[var(--color-primary)] px-4 py-1.5 text-xs font-bold text-[var(--color-primary-deep)] hover:bg-[var(--color-soft)] disabled:opacity-50"
            >
              {generating ? t("generatingSteps") : t("generateSteps")}
            </button>
            <span className="text-[11px] text-[var(--color-muted)]">{t("stepTtsHint")}</span>
          </div>

          {LIST_STEPS.map((st, idx) => (
            <div key={st}>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                STEP {idx + 1} · {tSteps(st)}
              </p>
              <div className="mt-2 grid gap-2">
                {lists[st].map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      value={v}
                      maxLength={200}
                      rows={1}
                      onChange={(e) => setItem(st, i, e.target.value)}
                      className="field-sizing-content min-h-9 w-full resize-y rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(st, i)}
                      aria-label={t("removeItem")}
                      className="shrink-0 rounded-lg border border-[var(--color-line)] px-3 text-xs font-bold text-[var(--color-muted)] hover:border-red-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {lists[st].length < 15 && (
                <button
                  type="button"
                  onClick={() => addItem(st)}
                  className="mt-2 text-[11px] font-bold text-[var(--color-primary-deep)] hover:underline"
                >
                  {t("addItem")}
                </button>
              )}
            </div>
          ))}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              STEP 4 · {tSteps("passage")}
            </p>
            <textarea
              value={passage}
              maxLength={600}
              rows={4}
              onChange={(e) => setPassage(e.target.value)}
              placeholder={t("passagePlaceholder")}
              className="mt-2 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("instructions")}</span>
        <textarea
          name="instructions"
          maxLength={2000}
          rows={2}
          defaultValue={initial?.instructions ?? ""}
          placeholder={t("instructionsPlaceholder")}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("dueDate")}</span>
        <input
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate ?? ""}
          className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] sm:w-48"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          <span aria-hidden>✓</span>
          {t("saved")}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : mode === "create" ? t("createBtn") : t("save")}
        </button>
      </div>
    </form>
  );
}
