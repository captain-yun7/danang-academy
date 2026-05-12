import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function DeprecatedQrPage() {
  const t = await getTranslations("qr.deprecated");
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-5xl text-amber-600">
        !
      </div>
      <h1 className="mt-6 text-2xl font-black">{t("title")}</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{t("desc")}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full border-2 border-[var(--color-line)] px-5 py-2 text-sm font-bold"
      >
        {t("home")}
      </Link>
    </main>
  );
}
