import { getTranslations } from "next-intl/server";
import { StartForm } from "./start-form";

const STEPS = ["s1", "s2", "s3", "s4"] as const;

export default async function PlacementIntroPage() {
  const t = await getTranslations("pt");
  return (
    <div className="mx-auto max-w-xl px-6 py-12 lg:py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 text-[var(--color-muted)]">{t("intro")}</p>

      <ol className="mt-6 grid gap-3 text-sm">
        {STEPS.map((key, i) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3"
          >
            <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
              {i + 1}
            </span>
            <span>{t(`steps.${key}`)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <StartForm />
      </div>
    </div>
  );
}
