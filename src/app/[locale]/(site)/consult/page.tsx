import { getTranslations } from "next-intl/server";
import { ConsultForm } from "./consult-form";

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    testId?: string;
    level?: string;
  }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("consultPage");
  return (
    <div className="mx-auto max-w-xl px-6 py-12 lg:py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 text-[var(--color-muted)]">{t("intro")}</p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <ConsultForm
          source={sp.source ?? "landing"}
          sourceTestId={sp.testId}
          recommendedLevel={sp.level}
        />
      </div>
    </div>
  );
}
