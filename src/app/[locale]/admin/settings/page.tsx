import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { LocationForm } from "./location-form";
import { GradeCutForm } from "./grade-cut-form";

type OrgRow = {
  id: string;
  name: string;
  display_name: string | null;
  lat: string | null;
  lng: string | null;
  gps_radius_m: number;
  grade_cut_excellent: number;
  grade_cut_good: number;
  grade_cut_normal: number;
};

export default async function SettingsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId) redirect("/login");
  if (!["super_admin", "owner", "manager"].includes(role)) redirect("/admin");

  const rows = (await sql`
    select id::text, name, display_name, lat, lng, gps_radius_m,
           grade_cut_excellent, grade_cut_good, grade_cut_normal
    from organizations where id = ${organizationId} limit 1
  `) as OrgRow[];
  const org = rows[0];
  if (!org) redirect("/admin");

  const t = await getTranslations("admin.settings");

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("subtitle")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{t("intro")}</p>

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="text-base font-bold">{t("locationTitle")}</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t("locationDesc")}</p>
        <div className="mt-5">
          <LocationForm
            initial={{
              lat: org.lat !== null ? Number(org.lat) : null,
              lng: org.lng !== null ? Number(org.lng) : null,
              radiusM: org.gps_radius_m,
            }}
          />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="text-base font-bold">주말 평가 등급 기준</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          평균 점수에 따른 학습 결과 등급(우수·양호·보통·보충 필요)의 임계값을 설정합니다.
        </p>
        <div className="mt-5">
          <GradeCutForm
            initial={{
              excellent: org.grade_cut_excellent,
              good: org.grade_cut_good,
              normal: org.grade_cut_normal,
            }}
          />
        </div>
      </section>
    </div>
  );
}
