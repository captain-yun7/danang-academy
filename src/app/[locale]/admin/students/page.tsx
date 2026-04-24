import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("admin.pages.students");
  return (
    <div className="py-8 text-center">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{t("desc")}</p>
    </div>
  );
}
