import { getTranslations } from "next-intl/server";
import { LoginTabs } from "./login-tabs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const t = await getTranslations("loginPage");
  return (
    <div className="mx-auto max-w-md px-6 py-16 lg:py-24">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{t("intro")}</p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <LoginTabs searchParamsPromise={searchParams} />
      </div>
    </div>
  );
}
