import { getTranslations } from "next-intl/server";
import type { StudentReport } from "@/lib/reports/student-report";

const STATUS_KEYS: Record<string, string> = {
  waiting: "수강 대기",
  active: "수강중",
  paused: "휴학",
  graduated: "수료",
  dropped: "이탈",
};

// 학생 자기조회 + 교사 조회 공용. studentPortal.report 네임스페이스 사용.
export async function StudentReportView({ report }: { report: StudentReport }) {
  const t = await getTranslations("studentPortal.report");
  const tType = await getTranslations("admin.assignments.types");

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label={t("pronAvg")} value={report.pronAvg !== null ? `${report.pronAvg}` : "—"} />
        <Kpi label={t("writingAvg")} value={report.writingAvg !== null ? `${report.writingAvg}` : "—"} />
        <Kpi label={t("completed")} value={`${report.completedCount}/${report.totalAssigned}`} />
        <Kpi label={t("completionRate")} value={`${report.completionRate}%`} />
        <Kpi
          label={t("improvement")}
          value={
            report.improvement !== null
              ? `${report.improvement > 0 ? "+" : ""}${report.improvement}`
              : "—"
          }
          hint={
            report.pronFirst !== null && report.pronLatest !== null
              ? `${t("first")} ${report.pronFirst} → ${t("latest")} ${report.pronLatest}`
              : undefined
          }
        />
        <Kpi label={t("statusLabel")} value={STATUS_KEYS[report.status] ?? report.status} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold">{t("history")}</h3>
        {report.history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-6 text-center text-sm text-[var(--color-muted)]">
            {t("noHistory")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--color-line)]">
                {report.history.map((h, i) => (
                  <tr key={`${h.assignmentId}-${i}`}>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-muted)]">{h.date ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-[11px] font-semibold">
                        {tType(h.type)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{h.title}</td>
                    <td className="px-4 py-2.5 text-right font-black text-[var(--color-primary-deep)]">
                      {h.score !== null ? h.score : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-center">
      <div className="text-2xl font-black text-[var(--color-primary-deep)]">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}
