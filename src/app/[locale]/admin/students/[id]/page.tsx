import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { buildStudentReport } from "@/lib/reports/student-report";
import { StudentReportView } from "@/components/student-report-view";
import { StudentForm } from "../student-form";
import { StudentLoginCredential } from "../student-login-credential";
import { NotesSection, type StudentNote } from "../notes/notes-section";

type LevelKey = "beginner" | "elementary" | "intermediate" | "advanced";

type PronTrendRow = {
  kind: "step" | "total";
  title: string;
  step_no: number | null;
  step_type: string | null;
  total: number | null;
  accuracy: number | null;
  pronunciation: number | null;
  fluency: number | null;
  completion: number | null;
  d: string | null;
};

const SUB_SCORE_MAX = [
  ["accuracy", 40],
  ["pronunciation", 30],
  ["fluency", 20],
  ["completion", 10],
] as const;

// 세부 점수 미니 바 (차트 라이브러리 없이 CSS)
function ScoreBars({
  row,
  labels,
}: {
  row: PronTrendRow;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {SUB_SCORE_MAX.map(([key, max]) => {
        const value = row[key];
        if (value == null) return null;
        return (
          <span key={key} className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              {labels[key]}
            </span>
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--color-soft)]">
              <span
                className="block h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </span>
            <span className="text-[10px] font-bold">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select s.id::text, s.name, s.phone,
           s.native_language::text,
           s.korean_level::text,
           s.class_id::text,
           s.parent_contact,
           s.student_code,
           (s.password_hash is not null) as has_password,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           s.status::text,
           c.name as class_name
    from students s
    left join classes c on c.id = s.class_id
    where s.id = ${id} and s.organization_id = ${orgId}
    limit 1
  `) as Array<{
    id: string;
    name: string;
    phone: string | null;
    native_language: string;
    korean_level: string | null;
    class_id: string | null;
    parent_contact: string | null;
    student_code: string | null;
    has_password: boolean;
    enrolled_at: string | null;
    status: string;
    class_name: string | null;
  }>;
  if (!rows[0]) notFound();
  const s = rows[0];

  const classes = (await sql`
    select id::text, name, level::text from classes
    where organization_id = ${orgId}
    order by name
  `) as { id: string; name: string; level: string }[];

  const recentLogs = (await sql`
    select kind::text, to_char(logged_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as ts
    from attendance_logs
    where student_id = ${id} and organization_id = ${orgId}
    order by logged_at desc
    limit 20
  `) as { kind: string; ts: string }[];

  const notes = (await sql`
    select n.id::text, n.content, n.category, n.author_id::text,
           u.name as author_name,
           to_char(n.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from student_notes n
    left join users u on u.id = n.author_id
    where n.student_id = ${id} and n.organization_id = ${orgId}
    order by n.created_at desc
    limit 50
  `) as StudentNote[];

  const report = await buildStudentReport(id, orgId);

  // 발음 진행 추이: 완료된 단계별 제출 + 발음 과제 집계 제출 (최신순 20개)
  const pronTrend = (await sql`
    select kind, title, step_no, step_type, total, accuracy, pronunciation, fluency, completion, d from (
      select 'step' as kind, a.title, ss.step_no, st.step_type,
             ss.total_score as total, ss.accuracy_score as accuracy,
             ss.pronunciation_score as pronunciation, ss.fluency_score as fluency,
             ss.completion_score as completion,
             ss.submitted_at as ts,
             to_char(ss.submitted_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as d
      from assignment_step_submissions ss
      join assignments a on a.id = ss.assignment_id
      left join assignment_steps st
        on st.assignment_id = ss.assignment_id and st.step_no = ss.step_no
      where ss.student_id = ${id} and ss.organization_id = ${orgId} and ss.status = 'completed'
      union all
      select 'total' as kind, a.title, null, null,
             sub.score, sub.accuracy_score, sub.pronunciation_score, sub.fluency_score,
             sub.completion_score,
             sub.submitted_at,
             to_char(sub.submitted_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
      from assignment_submissions sub
      join assignments a on a.id = sub.assignment_id
      where sub.student_id = ${id} and sub.organization_id = ${orgId}
        and a.type = 'pronunciation' and sub.score is not null
        and sub.status in ('completed', 'graded')
    ) x
    order by ts desc nulls last
    limit 20
  `) as PronTrendRow[];

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const currentRole = (session?.user as { role?: string } | undefined)?.role ?? "teacher";

  const t = await getTranslations("admin.students.detail");
  const tList = await getTranslations("admin.students");
  const tLevel = await getTranslations("admin.students.level");
  const tSteps = await getTranslations("admin.assignments.steps");
  const tScores = await getTranslations("admin.assignments.scores");

  const scoreLabels = {
    accuracy: tScores("accuracy"),
    pronunciation: tScores("pronunciation"),
    fluency: tScores("fluency"),
    completion: tScores("completion"),
  };

  return (
    <div>
      <Link
        href="/admin/students"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {tList("backToList")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{s.name}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {s.student_code ? `${s.student_code} · ` : ""}
        {s.class_name ? `${s.class_name} · ` : ""}
        {s.korean_level ? tLevel(s.korean_level as LevelKey) : t("levelUndefined")}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">{t("editTitle")}</h2>
          <StudentForm
            mode="edit"
            classes={classes}
            initial={{
              id: s.id,
              name: s.name,
              phone: s.phone,
              nativeLanguage: s.native_language,
              koreanLevel: s.korean_level,
              classId: s.class_id,
              parentContact: s.parent_contact,
              enrolledAt: s.enrolled_at,
              status: s.status,
              studentCode: s.student_code,
            }}
          />
        </section>

        <section className="space-y-4">
          <StudentLoginCredential
            studentId={s.id}
            studentCode={s.student_code}
            hasPassword={s.has_password}
          />
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              {t("recentAttendance", { count: recentLogs.length })}
            </p>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">{t("noLogs")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {recentLogs.map((l, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        l.kind === "check_in"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {l.kind === "check_in" ? t("checkIn") : t("checkOut")}
                    </span>
                    <span className="text-[var(--color-muted)]">{l.ts}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {report && (
        <div className="mt-8">
          <h2 className="mb-4 text-base font-bold">{t("reportTitle")}</h2>
          <StudentReportView report={report} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-4 text-base font-bold">{t("pronTrendTitle")}</h2>
        {pronTrend.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-8 text-center text-sm text-[var(--color-muted)]">
            {t("pronTrendEmpty")}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-white">
            {pronTrend.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-20 shrink-0 text-[11px] text-[var(--color-muted)]">
                  {r.d ?? "—"}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-xs font-semibold">{r.title}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {r.kind === "step"
                      ? `STEP ${r.step_no}${r.step_type ? ` · ${tSteps(r.step_type)}` : ""}`
                      : t("pronTrendOverall")}
                  </p>
                </div>
                <span className="text-sm font-black text-[var(--color-primary-deep)]">
                  {r.total ?? "—"}
                  <span className="text-[10px] font-semibold text-[var(--color-muted)]">/100</span>
                </span>
                <ScoreBars row={r} labels={scoreLabels} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <NotesSection
          studentId={s.id}
          notes={notes}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      </div>
    </div>
  );
}
