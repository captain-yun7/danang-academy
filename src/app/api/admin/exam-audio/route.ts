import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { getR2, r2Bucket } from "@/lib/r2/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["super_admin", "owner", "manager"];

// 듣기 문항 음성 업로드 (관리자). raw binary body + ?examId=. R2 키 반환.
export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !ALLOWED.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const examId = new URL(req.url).searchParams.get("examId");
  if (!examId) return NextResponse.json({ error: "missing examId" }, { status: 400 });

  const contentType = req.headers.get("content-type") || "audio/mpeg";
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > 10 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });

  const ext = contentType.includes("mpeg") || contentType.includes("mp3")
    ? "mp3"
    : contentType.includes("webm")
      ? "webm"
      : contentType.includes("mp4") || contentType.includes("m4a")
        ? "m4a"
        : contentType.includes("ogg")
          ? "ogg"
          : contentType.includes("wav")
            ? "wav"
            : "bin";
  const key = `exam-audio/${examId}/${randomUUID()}.${ext}`;

  const useMock = process.env.MOCK_R2_UPLOAD === "true" || !process.env.R2_BUCKET;
  if (!useMock) {
    await getR2().send(
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
        Body: new Uint8Array(buf),
        ContentType: contentType,
      })
    );
  }
  return NextResponse.json({ ok: true, key });
}
