import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { adminMenuKeys } from "@/lib/site";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tSite = await getTranslations("site");
  const tA = await getTranslations("admin");

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[var(--color-soft)]">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-28 rounded-xl bg-white p-4 ring-1 ring-black/5">
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--color-line)] pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-ink)] text-xs font-black text-[var(--color-primary)]">
                {tSite("shortName")}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {tA("groupTitle")}
                </p>
                <p className="text-sm font-bold">
                  {tSite("shortName")} Admin
                </p>
              </div>
            </div>
            <nav className="flex flex-col gap-0.5">
              {adminMenuKeys.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex flex-col rounded-md px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-soft)]"
                >
                  <span>{tA(`menu.${n.key}.label`)}</span>
                  <span className="text-[11px] font-normal text-[var(--color-muted)]">
                    {tA(`menu.${n.key}.desc`)}
                  </span>
                </Link>
              ))}
            </nav>
            <Link
              href="/"
              className="mt-4 block rounded-md border border-[var(--color-line)] px-3 py-2 text-center text-xs font-semibold hover:bg-[var(--color-primary)]"
            >
              ← {tSite("publicSite")}
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-xl bg-white p-6 ring-1 ring-black/5 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
