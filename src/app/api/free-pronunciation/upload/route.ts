import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id from free_pronunciation_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as { id: string }[];
  if (!owned[0]) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "audio/webm";
  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  const ext = contentType.includes("webm")
    ? "webm"
    : contentType.includes("mp4")
      ? "m4a"
      : contentType.includes("ogg")
        ? "ogg"
        : "bin";

  const blob = await put(`free-pronunciation/${id}.${ext}`, arrayBuffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await sql`update free_pronunciation_tests set audio_url = ${blob.url} where id = ${id}`;

  return NextResponse.json({ ok: true, url: blob.url });
}
