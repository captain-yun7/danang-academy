import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { courses } from "@/lib/site";
import { routing } from "@/i18n/routing";

type Params = { locale: string; slug: string };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    courses.map((c) => ({ locale, slug: c.slug })),
  );
}

export default async function CoursePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);
  if (!course) notFound();

  const t = await getTranslations("courses");
  const tP = await getTranslations("placeholder");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <span className="eyebrow">{t(`items.${course.key}.level`)}</span>
      <h1 className="mt-3 text-3xl font-bold text-[var(--color-ink)] sm:text-4xl">
        {t(`items.${course.key}.title`)}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
        {t(`items.${course.key}.desc`)}
      </p>
      <p className="mt-6 text-xs text-[var(--color-muted)]">{tP("comingSoon")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-ink)] px-5 py-2.5 text-sm font-bold text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
      >
        ← {tP("backHome")}
      </Link>
    </div>
  );
}
