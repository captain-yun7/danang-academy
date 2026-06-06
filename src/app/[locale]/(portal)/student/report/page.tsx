import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireStudent } from "@/lib/auth/student";
import { buildStudentReport } from "@/lib/reports/student-report";
import { StudentReportView } from "@/components/student-report-view";

export default async function StudentReportPage() {
  const t = await getTranslations("studentPortal.report");
  const { studentId, organizationId } = await requireStudent();
  const report = await buildStudentReport(studentId, organizationId);

  return (
    <div>
      <Link
        href="/student"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {t("back")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("intro")}</p>
      <div className="mt-6">
        {report && <StudentReportView report={report} />}
      </div>
    </div>
  );
}
