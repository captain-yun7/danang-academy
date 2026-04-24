import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { levelKeys } from "@/lib/site";

export async function Hero() {
  const t = await getTranslations("hero");
  const tLevels = await getTranslations("levels");

  return (
    <section className="relative overflow-hidden bg-[var(--color-soft)]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(253,213,97,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(250,168,24,0.15), transparent 45%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.15] text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
            {t("titleLine1")} <br />
            <span className="relative inline-block">
              <span
                className="absolute inset-x-0 bottom-1 h-4 bg-[var(--color-primary)]"
                aria-hidden
              />
              <span className="relative">{t("titleHighlight")}</span>
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
            {t("description")}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/free-pronunciation"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--color-primary-deep)]"
            >
              {t("ctaPrimary")} <span aria-hidden>→</span>
            </Link>
            <Link
              href="/placement"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-ink)] bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-black/10 pt-6">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t("stats.students")}
              </dt>
              <dd className="mt-1 text-xl font-bold">{t("stats.studentsValue")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t("stats.topik")}
              </dt>
              <dd className="mt-1 text-xl font-bold">{t("stats.topikValue")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t("stats.classes")}
              </dt>
              <dd className="mt-1 text-xl font-bold">{t("stats.classesValue")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <p className="eyebrow">{t("form.eyebrow")}</p>
          <h2 className="mt-1 text-xl font-bold">{t("form.title")}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t("form.subtitle")}</p>

          <form className="mt-5 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                {t("form.name")} <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                required
                placeholder={t("form.namePlaceholder")}
                className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary-deep)]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">
                  {t("form.phone")} <span className="text-red-500">*</span>
                </span>
                <input
                  type="tel"
                  required
                  placeholder={t("form.phonePlaceholder")}
                  className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary-deep)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">{t("form.email")}</span>
                <input
                  type="email"
                  placeholder={t("form.emailPlaceholder")}
                  className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary-deep)]"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold">{t("form.level")}</span>
              <select
                className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary-deep)]"
                defaultValue="none"
              >
                {levelKeys.map((k) => (
                  <option key={k} value={k}>
                    {tLevels(k)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-[var(--color-ink)] hover:bg-[var(--color-primary-deep)] hover:text-white"
            >
              {t("form.submit")}
            </button>
            <p className="text-[11px] text-[var(--color-muted)]">{t("form.privacy")}</p>
          </form>
        </div>
      </div>
    </section>
  );
}
