"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !["super_admin", "owner", "manager"].includes(role)) {
    throw new Error("forbidden");
  }
  return session!;
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export async function toggleMcqActive(input: z.infer<typeof toggleSchema>) {
  await requireAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`update mcq_questions set active = ${parsed.data.active} where id = ${parsed.data.id}`;
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
  const session = await requireAdmin();
  const parsed = thresholdSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const userId = (session.user as { id?: string }).id;
  await sql`
    insert into app_settings (key, value, updated_by, updated_at)
    values ('mcq_level_thresholds', ${JSON.stringify(parsed.data)}::jsonb, ${userId ?? null}, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now()
  `;
  revalidatePath("/admin/mcq");
}
