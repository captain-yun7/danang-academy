import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { presignGet } from "@/lib/r2/presign";
import { AssignmentForm } from "../assignment-form";
import { SubmissionAudio } from "../submission-audio";
import { GradeWriting } from "../grade-writing";
import { TtsControls, DeleteAssignmentButton } from "../tts-controls";

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
  strengths: string | null;
  improvements: string | null;
  submission_text: string | null;
  teacher_score: number | null;
  teacher_comment: string | null;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  submitted: "bg-amber-100 text-amber-700",
  graded: "bg-emerald-100 text-emerald-700",
};

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
           s.status::text, s.audio_key, s.transcript, s.score, s.strengths, s.improvements,
           s.submission_text, s.teacher_score, s.teacher_comment
    from assignment_submissions s
    join students st on st.id = s.student_id
    where s.assignment_id = ${id} and s.organization_id = ${orgId}
    order by st.student_code nulls last, st.name
  `) as Submission[];

  const ttsUrl =
    isPron && a.tts_status === "ready" && a.tts_audio_key
      ? await presignGet(a.tts_audio_key, 60 * 30)
      : null;

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
              type: a.type as "pronunciation" | "writing",
              targetType: (a.target_type as "all" | "class" | "students") ?? "all",
              classId: a.class_id,
              studentIds: targetStudentIds,
              title: a.title,
              instructions: a.instructions,
              targetText: a.target_text,
              dueDate: a.due_date,
            }}
          />
        </section>

        {isPron && (
          <section className="space-y-4">
            <TtsControls assignmentId={a.id} ttsStatus={a.tts_status} ttsUrl={ttsUrl} />
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
            {submissions.map((s) => (
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
                  {!isPron && s.teacher_score !== null && (
                    <span className="ml-auto text-lg font-black text-[var(--color-primary-deep)]">
                      {s.teacher_score}
                      <span className="text-xs font-semibold text-[var(--color-muted)]">/100</span>
                    </span>
                  )}
                </div>

                {isPron && (
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

                {!isPron && (
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
