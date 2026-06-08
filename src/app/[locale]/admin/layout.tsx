import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { adminMenuGroups } from "@/lib/site";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tSite = await getTranslations("site");
  const tA = await getTranslations("admin");

  const groups = adminMenuGroups.map((g) => ({
    group: g.group,
    label: tA(`menuGroups.${g.group}`),
    items: g.items.map((key) => ({
      key,
      href: `/admin${key === "dashboard" ? "" : `/${key}`}`,
      label: tA(`menu.${key}.label`),
      desc: tA(`menu.${key}.desc`),
    })),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 상단 다크 바 (Mistral 콘솔 톤) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[var(--color-ink)] px-4 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md text-xs font-black text-white brand-gradient">
            다프
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {tA("groupTitle")}
            </p>
            <p className="text-sm font-bold">{tSite("shortName")} Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="dark" />
          <Link
            href="/"
            className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/10 sm:inline-flex"
          >
            ← {tSite("publicSite")}
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 좌측 사이드바 — 그룹형 네비 */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-soft)] px-3 py-5 lg:flex">
          <Link href="/" aria-label={tSite("name")} className="mb-6 block px-2">
            <Image
              src="/logo.png"
              alt={tSite("name")}
              width={220}
              height={56}
              className="h-7 w-auto"
            />
          </Link>

          <AdminNav groups={groups} />

          <div className="mt-auto pt-6">
            <Link
              href="/"
              className="block rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-center text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:hidden"
            >
              ← {tSite("publicSite")}
            </Link>
          </div>
        </aside>

        {/* 본문 — 플랫 화이트 */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
