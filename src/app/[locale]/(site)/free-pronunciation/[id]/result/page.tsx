import { getTranslations } from "next-intl/server";
import { ResultClient } from "./result-client";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("fpt.result");
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">{t("step")}</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <ResultClient id={id} />
    </div>
  );
}
