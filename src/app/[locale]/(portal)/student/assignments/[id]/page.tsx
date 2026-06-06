import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyAssignmentDetail } from "../../actions";
import { AssignmentRunner } from "./assignment-runner";

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("studentPortal.run");
  const detail = await getMyAssignmentDetail(id);
  if (!detail) notFound();

  return (
    <div>
      <Link
        href="/student"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {t("back")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{detail.title}</h1>
      {detail.instructions && (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{detail.instructions}</p>
      )}
      {detail.due_date && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t("due")} {detail.due_date}
        </p>
      )}

      <div className="mt-6">
        <AssignmentRunner detail={detail} />
      </div>
    </div>
  );
}
