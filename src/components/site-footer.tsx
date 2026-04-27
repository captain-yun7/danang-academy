import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { contact, primaryNavSlugs, secondaryNavSlugs, social } from "@/lib/site";

export async function SiteFooter() {
  const tSite = await getTranslations("site");
  const tNav = await getTranslations("nav");
  const tFooter = await getTranslations("footer");

  return (
    <footer className="mt-24 bg-[var(--color-ink)] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-white px-3 py-2 ring-1 ring-white/10"
            aria-label={tSite("name")}
          >
            <Image
              src="/logo.png"
              alt={tSite("name")}
              width={220}
              height={56}
              className="h-9 w-auto"
            />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            {tSite("tagline")}
            <br />
            <span className="text-white/50">{tSite("taglineAlt")}</span>
          </p>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            {tFooter("courses")}
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            {primaryNavSlugs.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="hover:text-[var(--color-accent)]">
                  {tNav(`primary.${c.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            {tFooter("quickLinks")}
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            {secondaryNavSlugs
              .filter((s) => s.key !== "home")
              .map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-[var(--color-accent)]">
                    {tNav(`secondary.${n.key}`)}
                  </Link>
                </li>
              ))}
            <li>
              <Link href="/free-pronunciation" className="hover:text-[var(--color-accent)]">
                {tFooter("freeTest")}
              </Link>
            </li>
            <li>
              <Link href="/placement" className="hover:text-[var(--color-accent)]">
                {tFooter("placementTest")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            {tFooter("contact")}
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>📍 {tSite("address")}</li>
            <li>
              📞{" "}
              <a href={`tel:${contact.phone}`} className="hover:text-[var(--color-accent)]">
                {contact.phone}
              </a>
            </li>
            <li>
              ✉️{" "}
              <a href={`mailto:${contact.email}`} className="hover:text-[var(--color-accent)]">
                {contact.email}
              </a>
            </li>
            <li className="pt-2 text-xs text-white/50">{tSite("hours")}</li>
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(social).map(([k, v]) => (
              <a
                key={k}
                href={v}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold capitalize hover:border-[var(--color-primary)] hover:text-[var(--color-accent)]"
              >
                {k}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <p className="mx-auto max-w-7xl px-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} {tSite("name")}. {tSite("rightsReserved")}
          <Link href="/privacy" className="ml-4 hover:text-white/80">
            {tSite("privacy")}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-white/80">
            {tSite("terms")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
