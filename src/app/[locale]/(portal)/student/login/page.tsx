import { getTranslations } from "next-intl/server";
import { StudentLoginForm } from "./login-form";

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const t = await getTranslations("studentPortal.login");
  return (
    <div className="mx-auto max-w-sm py-10">
      <p className="brand-gradient-text text-center text-2xl font-black">
        {t("brand")}
      </p>
      <h1 className="mt-6 text-center text-xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-center text-sm text-[var(--color-muted)]">{t("intro")}</p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <StudentLoginForm searchParamsPromise={searchParams} />
      </div>
    </div>
  );
}
