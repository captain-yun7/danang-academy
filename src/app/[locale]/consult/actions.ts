"use server";

import { z } from "zod";
import { sql } from "@/lib/db/client";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(5).max(40),
  email: z.string().email().optional().or(z.literal("")),
  recommendedLevel: z
    .enum(["beginner", "elementary", "intermediate", "advanced"])
    .optional(),
  source: z.string().max(40).default("landing"),
  sourceTestId: z.string().uuid().optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export type ConsultInput = z.infer<typeof schema>;

export async function submitConsult(
  input: ConsultInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const d = parsed.data;

  await sql`
    insert into consult_leads
      (name, phone, email, source, source_test_id, recommended_level, note, status)
    values
      (${d.name}, ${d.phone}, ${d.email || null},
       ${d.source}, ${d.sourceTestId ? d.sourceTestId : null},
       ${d.recommendedLevel ? d.recommendedLevel : null}::korean_level,
       ${d.note || null}, 'new')
  `;
  return { ok: true };
}
