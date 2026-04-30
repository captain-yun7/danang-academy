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

  let audioUrl: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`free-pronunciation/${id}.${ext}`, arrayBuffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    audioUrl = blob.url;
  } else {
    // Blob 토큰이 없는 개발 환경 — 가짜 URL로 진행해 후속 플로우 테스트
    audioUrl = `mock://free-pronunciation/${id}.${ext}`;
  }

  await sql`update free_pronunciation_tests set audio_url = ${audioUrl} where id = ${id}`;

  // Mock AI 워커 — 환경변수로 명시 활성화 시에만
  if (process.env.MOCK_AI_WORKER === "true") {
    queueMockEvaluation(id);
  }

  return NextResponse.json({ ok: true, url: audioUrl });
}

function queueMockEvaluation(id: string) {
  const delayMs = 4000;
  setTimeout(async () => {
    try {
      await sql`update free_pronunciation_tests set status='processing' where id = ${id}`;
      await new Promise((r) => setTimeout(r, 2000));
      const score = 70 + Math.floor(Math.random() * 25);
      const level =
        score >= 90 ? "advanced" : score >= 80 ? "intermediate" : score >= 70 ? "elementary" : "beginner";
      await sql`
        update free_pronunciation_tests
        set status='completed',
            transcript = target_sentence,
            score = ${score},
            strengths = ${"속도와 억양이 자연스러워요. 또박또박 잘 발음했어요."},
            improvements = ${"받침 발음을 조금 더 명확히 하면 좋아요. 'ㄴ/ㅁ/ㅇ' 구분을 신경 써보세요."},
            recommended_class_level = ${level}
        where id = ${id}
      `;
    } catch (e) {
      console.error("mock evaluation failed:", e);
      await sql`update free_pronunciation_tests set status='failed' where id = ${id}`.catch(() => {});
    }
  }, delayMs);
}
