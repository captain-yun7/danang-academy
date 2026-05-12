import { getTranslations } from "next-intl/server";
import { WaitClient } from "./wait-client";

export default async function WaitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("pt.wait");
  return (
    <div className="mx-auto max-w-xl px-6 py-16 lg:py-24 text-center">
      <p className="eyebrow">{t("step")}</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <WaitClient id={id} />
    </div>
  );
}
