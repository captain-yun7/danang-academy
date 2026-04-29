import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Hero } from "@/components/hero";
import {
  activityKeys,
  courses,
  newsItems,
  partners,
  teachers,
  testimonialKeys,
  testimonialNames,
} from "@/lib/site";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MainBanner />
      <Hero />
      <CoursesSection />
      <IntroSection />
      <TeachersSection />
      <StatsSection />
      <ActivitiesSection />
      <TestimonialsSection />
      <NewsSection />
      <PartnersSection />
      <FinalCTA />
    </>
  );
}

async function MainBanner() {
  const t = await getTranslations("hero");
  return (
    <Link
      href="/free-pronunciation"
      aria-label={t("ctaPrimary")}
      className="group block bg-[var(--color-ink)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
        <Image
          src="/main-banner.png"
          alt={t("ctaPrimary")}
          width={1980}
          height={460}
          priority
          className="h-auto w-full rounded-lg shadow-md transition group-hover:opacity-90"
        />
      </div>
    </Link>
  );
}

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`py-16 lg:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-6">{children}</div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title mt-2">{title}</h2>
      {subtitle && <p className="mt-3 text-[var(--color-muted)]">{subtitle}</p>}
    </div>
  );
}

async function CoursesSection() {
  const t = await getTranslations("courses");
  return (
    <Section id="courses">
      <SectionHead
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {courses.map((c) => (
          <Link
            key={c.slug}
            href={`/courses/${c.slug}`}
            className="card-lift flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white"
          >
            <div
              className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[var(--color-primary)]/40 via-[var(--color-soft)] to-white"
              aria-hidden
            >
              <span className="text-5xl font-black text-[var(--color-ink)]/15">
                {t(`items.${c.key}.title`).charAt(0)}
              </span>
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink)]">
                ★ {c.rating.toFixed(1)} · {t("sessions", { count: c.sessions })}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary-deep)]">
                {t(`items.${c.key}.level`)}
              </span>
              <h3 className="mt-1 text-base font-bold">{t(`items.${c.key}.title`)}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ink)]/80">
                {t(`items.${c.key}.desc`)}
              </p>
              <span className="mt-4 text-sm font-semibold text-[var(--color-ink)]">
                {t("detail")} →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

async function IntroSection() {
  const t = await getTranslations("about");
  const features = ["ai", "care", "report", "training"] as const;
  return (
    <Section id="about" className="bg-[var(--color-soft)]">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="section-title mt-2">{t("title")}</h2>
          <p className="mt-4 text-[var(--color-ink)]/80">{t("body")}</p>
          <Link
            href="/about"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--color-ink)] hover:text-[var(--color-primary-deep)]"
          >
            {t("more")} →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((k, i) => (
            <li
              key={k}
              className="card-lift rounded-xl bg-white p-5 ring-1 ring-black/5"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-black text-[var(--color-ink)]">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-base font-bold">{t(`features.${k}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {t(`features.${k}.desc`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

async function TeachersSection() {
  const t = await getTranslations("teachers");
  return (
    <Section id="teachers">
      <div className="mb-10 flex items-end justify-between gap-6">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
        />
        <Link
          href="/teachers"
          className="hidden text-sm font-bold text-[var(--color-ink)] hover:text-[var(--color-primary-deep)] sm:inline-block"
        >
          {t("viewAll")} →
        </Link>
      </div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((x) => (
          <li
            key={x.name}
            className="card-lift flex items-center gap-4 rounded-xl border border-[var(--color-line)] bg-white p-5"
          >
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/40 text-xl font-black text-[var(--color-ink)]"
              aria-hidden
            >
              {x.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold">{x.name}</p>
              <p className="text-xs text-[var(--color-primary-deep)]">
                {t(`roles.${x.roleKey}`)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {t(`bios.${x.bioKey}`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

async function StatsSection() {
  const t = await getTranslations("stats");
  const rows = [
    { label: t("students"), value: t("studentsValue") },
    { label: t("topik"), value: t("topikValue") },
    { label: t("classes"), value: t("classesValue") },
    { label: t("partners"), value: t("partnersValue") },
  ];
  return (
    <section className="bg-[var(--color-ink)] py-14 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-4xl font-black text-[var(--color-accent)] sm:text-5xl">
              {s.value}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/70">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function ActivitiesSection() {
  const t = await getTranslations("activities");
  return (
    <Section id="activities" className="bg-[var(--color-soft)]">
      <SectionHead
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {activityKeys.map((k) => (
          <li key={k} className="card-lift rounded-lg bg-white p-4 ring-1 ring-black/5">
            <p className="text-sm font-bold text-[var(--color-ink)]">
              {t(`items.${k}.title`)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {t(`items.${k}.note`)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

async function TestimonialsSection() {
  const t = await getTranslations("reviews");
  return (
    <Section id="reviews">
      <SectionHead
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonialKeys.map((k) => (
          <figure
            key={k}
            className="card-lift rounded-xl border border-[var(--color-line)] bg-white p-6"
          >
            <div className="text-3xl leading-none text-[var(--color-primary)]" aria-hidden>
              “
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed text-[var(--color-ink)]/85">
              {t(`items.${k}.quote`)}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--color-line)] pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/40 text-sm font-black">
                {testimonialNames[k]?.charAt(0)}
              </div>
              <div className="text-xs">
                <p className="font-bold">{testimonialNames[k]}</p>
                <p className="text-[var(--color-muted)]">{t(`items.${k}.role`)}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

async function NewsSection() {
  const t = await getTranslations("news");
  return (
    <Section id="news" className="bg-[var(--color-soft)]">
      <div className="mb-10 flex items-end justify-between gap-6">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} />
        <Link
          href="/news"
          className="hidden text-sm font-bold text-[var(--color-ink)] hover:text-[var(--color-primary-deep)] sm:inline-block"
        >
          {t("viewAll")} →
        </Link>
      </div>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {newsItems.map((n) => (
          <li
            key={n.key}
            className="card-lift flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-black/5"
          >
            <div
              className="aspect-[16/10] w-full bg-gradient-to-br from-[var(--color-primary)]/30 to-[var(--color-soft)]"
              aria-hidden
            />
            <div className="flex flex-1 flex-col p-5">
              <time className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary-deep)]">
                {n.date}
              </time>
              <h3 className="mt-2 text-base font-bold leading-snug">
                {t(`items.${n.key}.title`)}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {t(`items.${n.key}.excerpt`)}
              </p>
              <span className="mt-3 text-sm font-semibold text-[var(--color-ink)]">
                {t("read")} →
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

async function PartnersSection() {
  const t = await getTranslations("partners");
  return (
    <Section>
      <SectionHead eyebrow={t("eyebrow")} title={t("title")} />
      <ul className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        {partners.map((p) => (
          <li
            key={p.name}
            className="flex h-16 min-w-36 items-center justify-center rounded-lg border border-[var(--color-line)] bg-white px-6 text-sm font-black tracking-widest text-[var(--color-muted)]"
            title={p.name}
          >
            {p.logo}
          </li>
        ))}
      </ul>
    </Section>
  );
}

async function FinalCTA() {
  const t = await getTranslations("finalCta");
  return (
    <section className="brand-gradient">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-14 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {t("title")}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/free-pronunciation"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-[var(--color-ink)]"
          >
            {t("primary")} →
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
          >
            {t("secondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
