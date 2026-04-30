import { headers } from "next/headers";
import { createHash } from "node:crypto";

export async function getVisitorFingerprint(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const ua = h.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
}
