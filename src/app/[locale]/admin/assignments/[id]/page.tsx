import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { AssignmentForm, type StepsInitial } from "../assignment-form";
import { SubmissionAudio } from "../submission-audio";
import { GradeWriting } from "../grade-writing";
import { TtsControls, StepTtsControls, DeleteAssignmentButton } from "../tts-controls";

type Assignment = {
  id: string;
  type: string;
  class_id: string | null;
  target_type: string;
  title: string;
  instructions: string | null;
  target_text: string | null;
  tts_audio_key: string | null;
  tts_status: string | null;
  due_date: string | null;
};

type Submission = {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
  status: string;
  audio_key: string | null;
  transcript: string | null;
  score: number | null;
  accuracy_score: number | null;
  pronunciation_score: number | null;
  fluency_score: number | null;
  completion_score: number | null;
  listened_at: string | null;
  strengths: string | null;
  improvements: string | null;
  submission_text: string | null;
  teacher_score: number | null;
  teacher_comment: string | null;
};

type StepRow = {
  step_no: number;
  step_type: string;
  items: { text: string; ttsKey: string | null; ttsStatus: string }[];
};

type StepSub = {
  id: string;
  student_id: string;
  step_no: number;
  status: string;
  audio_key: string | null;
  duration_sec: number | null;
  transcript: string | null;
  accuracy_score: number | null;
  pronunciation_score: number | null;
  fluency_score: number | null;
  completion_score: number | null;
  total_score: number | null;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  submitted: "bg-amber-100 text-amber-700",
  graded: "bg-emerald-100 text-emerald-700",
};

const SUB_SCORE_MAX = [
  ["accuracy", 40],
  ["pronunciation", 30],
  ["fluency", 20],
  ["completion", 10],
] as const;

type SubScores = Record<(typeof SUB_SCORE_MAX)[number][0], number | null>;

// 세부 점수 4종 가로 미니 바 (서버 컴포넌트)
function ScoreBars({ scores, labels }: { scores: SubScores; labels: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {SUB_SCORE_MAX.map(([key, max]) => {
        const value = scores[key];
        if (value == null) return null;
        return (
          <span key={key} className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              {labels[key]}
            </span>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-soft)]">
              <span
                className="block h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </span>
            <span className="text-[10px] font-bold">
              {value}
              <span className="font-semibold text-[var(--color-muted)]">/{max}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const t = await getTranslations("admin.assignments.detail");
  const tList = await getTranslations("admin.assignments");
  const tStatus = await getTranslations("admin.assignments.status");
  const tSteps = await getTranslations("admin.assignments.steps");
  const tScores = await getTranslations("admin.assignments.scores");

  const rows = (await sql`
    select id::text, type::text, class_id::text, target_type, title, instructions, target_text,
           tts_audio_key, tts_status,
           to_char(due_date, 'YYYY-MM-DD') as due_date
    from assignments
    where id = ${id} and organization_id = ${orgId}
    limit 1
  `) as Assignment[];
  if (!rows[0]) notFound();
  const a = rows[0];
  const isPron = a.type === "pronunciation";
  const isListening = a.type === "listening";
  const isWriting = a.type === "writing";

  const steps = isPron
    ? ((await sql`
        select step_no, step_type, items from assignment_steps
        where assignment_id = ${id}
        order by step_no
      `) as StepRow[])
    : [];
  const isStepBased = steps.length > 0;

  const classes = (await sql`
    select id::text, name from classes where organization_id = ${orgId} order by name
  `) as { id: string; name: string }[];

  const studentList = (await sql`
    select s.id::text, s.name, s.student_code, c.name as class_name
    from students s
    left join classes c on c.id = s.class_id
    where s.organization_id = ${orgId}
    order by s.student_code nulls last, s.name
  `) as { id: string; name: string; student_code: string | null; class_name: string | null }[];

  const targetRows = (await sql`
    select student_id::text from assignment_targets where assignment_id = ${id}
  `) as { student_id: string }[];
  const targetStudentIds = targetRows.map((r) => r.student_id);

  const submissions = (await sql`
    select s.id::text, s.student_id::text, st.name as student_name, st.student_code,
           s.status::text, s.audio_key, s.transcript, s.score,
           s.accuracy_score, s.pronunciation_score, s.fluency_score, s.completion_score,
           to_char(s.listened_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as listened_at,
           s.strengths, s.improvements,
           s.submission_text, s.teacher_score, s.teacher_comment
    from assignment_submissions s
    join students st on st.id = s.student_id
    where s.assignment_id = ${id} and s.organization_id = ${orgId}
    order by st.student_code nulls last, st.name
  `) as Submission[];

  const stepSubs = isStepBased
    ? ((await sql`
        select id::text, student_id::text, step_no, status::text, audio_key, duration_sec,
               transcript, accuracy_score, pronunciation_score, fluency_score, completion_score,
               total_score
        from assignment_step_submissions
        where assignment_id = ${id} and organization_id = ${orgId}
        order by step_no
      `) as StepSub[])
    : [];
  const stepSubsByStudent = new Map<string, StepSub[]>();
  for (const ss of stepSubs) {
    const list = stepSubsByStudent.get(ss.student_id) ?? [];
    list.push(ss);
    stepSubsByStudent.set(ss.student_id, list);
  }

  const ttsUrl =
    (isPron || isListening) && !isStepBased && a.tts_status === "ready" && a.tts_audio_key
      ? await presignGet(a.tts_audio_key, 60 * 30)
      : null;

  const ttsCounts = { ready: 0, pending: 0, failed: 0 };
  for (const st of steps) {
    for (const item of st.items) {
      if (item.ttsStatus === "ready") ttsCounts.ready++;
      else if (item.ttsStatus === "failed") ttsCounts.failed++;
      else ttsCounts.pending++;
    }
  }

  const textsOf = (tp: string) =>
    steps.find((s) => s.step_type === tp)?.items.map((i) => i.text) ?? [];
  const stepsInitial: StepsInitial | null = isStepBased
    ? {
        word: textsOf("word"),
        phrase: textsOf("phrase"),
        sentence: textsOf("sentence"),
        passage: textsOf("passage")[0] ?? "",
      }
    : null;

  const scoreLabels = {
    accuracy: tScores("accuracy"),
    pronunciation: tScores("pronunciation"),
    fluency: tScores("fluency"),
    completion: tScores("completion"),
  };

  return (
    <div>
      <Link
        href="/admin/assignments"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {tList("backToList")}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{a.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {tList(`types.${a.type}`)}
            {isStepBased ? ` · ${tList("stepBadge")}` : ""}
            {a.due_date ? ` · ${t("due")} ${a.due_date}` : ""}
          </p>
        </div>
        <DeleteAssignmentButton assignmentId={a.id} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">{t("editTitle")}</h2>
          <AssignmentForm
            mode="edit"
            classes={classes}
            students={studentList.map((s) => ({
              id: s.id,
              name: s.name,
              studentCode: s.student_code,
              className: s.class_name,
            }))}
            initial={{
              id: a.id,
              type: a.type as "pronunciation" | "writing" | "listening",
              targetType: (a.target_type as "all" | "class" | "students") ?? "all",
              classId: a.class_id,
              studentIds: targetStudentIds,
              title: a.title,
              instructions: a.instructions,
              targetText: a.target_text,
              dueDate: a.due_date,
              steps: stepsInitial,
            }}
          />
        </section>

        {(isPron || isListening) && (
          <section className="space-y-4">
            {isStepBased ? (
              <StepTtsControls
                assignmentId={a.id}
                ready={ttsCounts.ready}
                pending={ttsCounts.pending}
                failed={ttsCounts.failed}
              />
            ) : (
              <TtsControls assignmentId={a.id} ttsStatus={a.tts_status} ttsUrl={ttsUrl} />
            )}
          </section>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-base font-bold">
          {t("submissionsTitle", { count: submissions.length })}
        </h2>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-8 text-center text-sm text-[var(--color-muted)]">
            {t("noSubmissions")}
          </div>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s) => {
              const mySteps = stepSubsByStudent.get(s.student_id) ?? [];
              return (
                <li key={s.id} className="rounded-xl border border-[var(--color-line)] bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.student_code && (
                      <span className="rounded bg-[var(--color-soft)] px-2 py-0.5 font-mono text-xs font-semibold">
                        {s.student_code}
                      </span>
                    )}
                    <span className="font-semibold">{s.student_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}>
                      {tStatus(s.status)}
                    </span>
                    {isPron && s.score !== null && (
                      <span className="ml-auto text-lg font-black text-[var(--color-primary-deep)]">
                        {s.score}
                        <span className="text-xs font-semibold text-[var(--color-muted)]">/100</span>
                      </span>
                    )}
                    {isWriting && s.teacher_score !== null && (
                      <span className="ml-auto text-lg font-black text-[var(--color-primary-deep)]">
                        {s.teacher_score}
                        <span className="text-xs font-semibold text-[var(--color-muted)]">/100</span>
                      </span>
                    )}
                  </div>

                  {/* 단계형: 집계 평균 세부 점수 + 단계별 결과 펼침 */}
                  {isStepBased && (
                    <div className="mt-3">
                      {s.score !== null && (
                        <ScoreBars
                          scores={{
                            accuracy: s.accuracy_score,
                            pronunciation: s.pronunciation_score,
                            fluency: s.fluency_score,
                            completion: s.completion_score,
                          }}
                          labels={scoreLabels}
                        />
                      )}
                      <details className="mt-3 rounded-lg border border-[var(--color-line)]">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]/50">
                          {t("stepResults", { count: mySteps.length })}
                        </summary>
                        <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                          {steps.map((st) => {
                            const ss = mySteps.find((x) => x.step_no === st.step_no);
                            return (
                              <li key={st.step_no} className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                    STEP {st.step_no} · {tSteps(st.step_type)}
                                  </span>
                                  {ss ? (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[ss.status]}`}
                                    >
                                      {tStatus(ss.status)}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[var(--color-muted)]">
                                      {t("stepNotSubmitted")}
                                    </span>
                                  )}
                                  {ss?.total_score != null && (
                                    <span className="ml-auto text-sm font-black text-[var(--color-primary-deep)]">
                                      {ss.total_score}
                                      <span className="text-[10px] font-semibold text-[var(--color-muted)]">
                                        /100
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {ss?.total_score != null && (
                                  <div className="mt-2">
                                    <ScoreBars
                                      scores={{
                                        accuracy: ss.accuracy_score,
                                        pronunciation: ss.pronunciation_score,
                                        fluency: ss.fluency_score,
                                        completion: ss.completion_score,
                                      }}
                                      labels={scoreLabels}
                                    />
                                  </div>
                                )}
                                {ss?.transcript && (
                                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                                    <span className="font-semibold">{t("transcript")}:</span>{" "}
                                    {ss.transcript}
                                  </p>
                                )}
                                {ss && (ss.audio_key || ss.duration_sec != null) && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {ss.audio_key && (
                                      <SubmissionAudio kind="step" submissionId={ss.id} />
                                    )}
                                    {ss.duration_sec != null && (
                                      <span className="text-[11px] text-[var(--color-muted)]">
                                        {t("durationSec", { sec: ss.duration_sec })}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    </div>
                  )}

                  {/* 단일형 발음 (기존 동작) */}
                  {isPron && !isStepBased && (
                    <div className="mt-3 grid gap-2 text-sm">
                      {s.audio_key && <SubmissionAudio submissionId={s.id} />}
                      {s.transcript && (
                        <p className="text-xs text-[var(--color-muted)]">
                          <span className="font-semibold">{t("transcript")}:</span> {s.transcript}
                        </p>
                      )}
                      {s.strengths && (
                        <p className="text-xs">
                          <span className="font-semibold text-emerald-700">{t("strengths")}:</span>{" "}
                          {s.strengths}
                        </p>
                      )}
                      {s.improvements && (
                        <p className="text-xs">
                          <span className="font-semibold text-amber-700">{t("improvements")}:</span>{" "}
                          {s.improvements}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 미리듣기: 청취 여부 */}
                  {isListening && (
                    <div className="mt-3">
                      {s.listened_at ? (
                        <p className="text-xs font-semibold text-emerald-700">
                          {t("listenedAt", { time: s.listened_at })}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--color-muted)]">{t("notListened")}</p>
                      )}
                    </div>
                  )}

                  {isWriting && (
                    <div className="mt-3">
                      {s.submission_text ? (
                        <p className="whitespace-pre-wrap rounded-lg bg-[var(--color-soft)] p-3 text-sm">
                          {s.submission_text}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--color-muted)]">{t("noText")}</p>
                      )}
                      {s.teacher_comment && (
                        <p className="mt-2 text-xs">
                          <span className="font-semibold">{t("comment")}:</span> {s.teacher_comment}
                        </p>
                      )}
                      {(s.status === "submitted" || s.status === "graded") && (
                        <GradeWriting
                          submissionId={s.id}
                          initialScore={s.teacher_score}
                          initialComment={s.teacher_comment}
                          graded={s.status === "graded"}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
