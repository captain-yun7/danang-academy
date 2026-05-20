import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CourseForm } from "../course-form";

export default async function NewCoursePage() {
  const t = await getTranslations("admin.courses");
  return (
    <div>
      <Link
        href="/admin/courses"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {t("backToList")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("newTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("newDesc")}</p>

      <div className="mt-6 max-w-3xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <CourseForm />
      </div>
    </div>
  );
}
