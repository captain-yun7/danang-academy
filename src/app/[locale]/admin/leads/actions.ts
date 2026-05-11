"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, organizationId };
}

const STATUS_VALUES = ["new", "contacted", "enrolled", "dropped"] as const;
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
});

export async function updateLeadStatus(input: z.infer<typeof updateSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    update consult_leads set status = ${parsed.data.status}
    where id = ${parsed.data.id} and organization_id = ${organizationId}
  `;
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

const noteSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(1000),
});
export async function updateLeadNote(input: z.infer<typeof noteSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    update consult_leads set note = ${parsed.data.note || null}
    where id = ${parsed.data.id} and organization_id = ${organizationId}
  `;
  revalidatePath("/admin/leads");
}
