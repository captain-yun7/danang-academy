"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !userId || !["super_admin", "owner", "manager"].includes(role)) {
    throw new Error("forbidden");
  }
  return { userId, role, organizationId };
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export async function toggleMcqActive(input: z.infer<typeof toggleSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  // organization_id is null = 공통 문항 (학원 모두에게 영향) → super_admin만 변경 가능 정책으로 추후 강화
  await sql`
    update mcq_questions set active = ${parsed.data.active}
    where id = ${parsed.data.id}
      and (organization_id = ${organizationId} or organization_id is null)
  `;
  revalidatePath("/admin/mcq");
  revalidatePath("/ko/admin/mcq");
  revalidatePath("/vi/admin/mcq");
}

const thresholdSchema = z.object({
  beginner: z.tuple([z.number().int(), z.number().int()]),
  elementary: z.tuple([z.number().int(), z.number().int()]),
  intermediate: z.tuple([z.number().int(), z.number().int()]),
  advanced: z.tuple([z.number().int(), z.number().int()]),
});

export async function updateThresholds(input: z.infer<typeof thresholdSchema>) {
  const { userId, organizationId } = await requireAdmin();
  const parsed = thresholdSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    insert into app_settings (organization_id, key, value, updated_by, updated_at)
    values (${organizationId}, 'mcq_level_thresholds', ${JSON.stringify(parsed.data)}::jsonb, ${userId}, now())
    on conflict (organization_id, key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now()
  `;
  revalidatePath("/admin/mcq");
}
