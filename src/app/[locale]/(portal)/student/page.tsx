import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getMyAssignments } from "./actions";

const EXAM_ATT: Record<string, string> = { doing: "응시 중", submitted: "채점 중", waiting_writing_review: "채점 중", finalized: "완료" };

const STATUS_TONE: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  submitted: "bg-amber-100 text-amber-700",
  graded: "bg-emerald-100 text-emerald-700",
};

export default async function StudentDashboard() {
  const t = await getTranslations("studentPortal.dashboard");
  const tType = await getTranslations("admin.assignments.types");
  const tStatus = await getTranslations("studentPortal.status");
  const assignments = await getMyAssignments();

  const student = await requireStudent();
  const weeklyTests = (await sql`
    select t.id::text, t.title, t.lesson_range, r.status
    from weekly_tests t
    join students s on s.id = ${student.studentId}::uuid
    left join weekly_results r on r.test_id = t.id and r.student_id = ${student.studentId}::uuid
    where t.organization_id = ${student.organizationId} and t.status = 'published' and t.class_id = s.class_id
    order by t.created_at desc
  `) as { id: string; title: string; lesson_range: string | null; status: string | null }[];

  const pending = assignments.filter((a) => !a.status || a.status === "pending" || a.status === "processing");
  const done = assignments.filter((a) => a.status === "completed" || a.status === "graded");
  const scores = assignments
    .map((a) => (a.type === "pronunciation" ? a.score : a.teacher_score))
    .filter((s): s is number => s !== null);
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Kpi label={t("kpiPending")} value={pending.length.toString()} />
        <Kpi label={t("kpiDone")} value={done.length.toString()} />
        <Kpi label={t("kpiAvg")} value={avg !== null ? avg.toString() : "—"} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          href="/student/exams"
          className="brand-gradient inline-block rounded-full px-4 py-2 text-sm font-bold text-white"
        >
          {t("viewExams")}
        </Link>
        <Link
          href="/student/report"
          className="inline-block text-sm font-bold text-[var(--color-primary-deep)] hover:underline"
        >
          {t("viewReport")} →
        </Link>
      </div>

      {weeklyTests.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">주간 시험</h2>
          <ul className="space-y-3">
            {weeklyTests.map((e) => {
              const done = e.status === "finalized";
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4">
                  <div>
                    <p className="font-bold">{e.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{e.lesson_range ? `${e.lesson_range}과` : "듣기·읽기·쓰기·말하기"}{e.status ? ` · ${EXAM_ATT[e.status] ?? e.status}` : ""}</p>
                  </div>
                  <Link href={done ? `/student/exams/${e.id}/result` : `/student/exams/${e.id}`} className={done ? "rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-primary)]" : "brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white"}>
                    {done ? "결과 보기" : e.status ? "이어서 응시" : "응시하기"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mt-8 mb-3 text-base font-bold">{t("myAssignments")}</h2>
      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center text-sm text-[var(--color-muted)]">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const score = a.type === "pronunciation" ? a.score : a.teacher_score;
            return (
              <li key={a.id}>
                <Link
                  href={`/student/assignments/${a.id}`}
                  className="card-lift flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-[11px] font-semibold">
                        {tType(a.type)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[a.status ?? "todo"] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {tStatus(a.status ?? "todo")}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-bold">{a.title}</p>
                    {a.due_date && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {t("due")} {a.due_date}
                      </p>
                    )}
                  </div>
                  {score !== null && (
                    <span className="shrink-0 text-xl font-black text-[var(--color-primary-deep)]">
                      {score}
                      <span className="text-xs font-semibold text-[var(--color-muted)]">/100</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-center">
      <div className="text-2xl font-black text-[var(--color-primary-deep)]">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  );
}
