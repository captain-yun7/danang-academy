"use server";

import { z } from "zod";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { presignGet } from "@/lib/r2/presign";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager", "teacher"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, organizationId };
}

const schema = z.object({
  testId: z.string().uuid(),
  type: z.enum(["free_pron", "placement"]),
});

export type AudioUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: "no_audio" | "not_found" | "forbidden" | "r2_disabled" };

export async function getTestAudioUrl(
  input: z.infer<typeof schema>
): Promise<AudioUrlResult> {
  const { organizationId } = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "not_found" };

  let key: string | null = null;
  if (parsed.data.type === "free_pron") {
    const rows = (await sql`
      select audio_url from free_pronunciation_tests
      where id = ${parsed.data.testId} and organization_id = ${organizationId}
      limit 1
    `) as { audio_url: string | null }[];
    if (!rows[0]) return { ok: false, error: "not_found" };
    key = rows[0].audio_url;
  } else {
    const rows = (await sql`
      select fpt.audio_url
      from placement_tests pt
      join free_pronunciation_tests fpt on fpt.id = pt.pronunciation_test_id
      where pt.id = ${parsed.data.testId} and pt.organization_id = ${organizationId}
      limit 1
    `) as { audio_url: string | null }[];
    if (!rows[0]) return { ok: false, error: "not_found" };
    key = rows[0].audio_url;
  }

  if (!key) return { ok: false, error: "no_audio" };
  if (!process.env.R2_BUCKET) return { ok: false, error: "r2_disabled" };

  const url = await presignGet(key);
  return { ok: true, url };
}
