"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

const schema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  radiusM: z.number().int().gte(10).lte(5000),
});

export async function updateOrgLocation(input: z.infer<typeof schema>) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId) throw new Error("forbidden");
  if (!["super_admin", "owner", "manager"].includes(role)) throw new Error("forbidden");

  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  await sql`
    update organizations
    set lat = ${d.lat}, lng = ${d.lng}, gps_radius_m = ${d.radiusM}
    where id = ${organizationId}
  `;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

const cutSchema = z
  .object({
    excellent: z.number().int().gte(1).lte(100),
    good: z.number().int().gte(1).lte(100),
    normal: z.number().int().gte(1).lte(100),
  })
  .refine((d) => d.excellent > d.good && d.good > d.normal, {
    message: "우수 > 양호 > 보통 순서여야 합니다.",
  });

export async function updateGradeCuts(input: z.infer<typeof cutSchema>) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId) throw new Error("forbidden");
  if (!["super_admin", "owner", "manager"].includes(role)) throw new Error("forbidden");

  const parsed = cutSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  await sql`
    update organizations
    set grade_cut_excellent = ${d.excellent}, grade_cut_good = ${d.good}, grade_cut_normal = ${d.normal}
    where id = ${organizationId}
  `;

  revalidatePath("/admin/settings");
}
