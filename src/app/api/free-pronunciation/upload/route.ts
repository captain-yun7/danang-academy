import { NextResponse, after } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { getVisitorFingerprint } from "@/lib/fingerprint";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { evaluatePronunciation, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";

export const runtime = "nodejs";
export const maxDuration = 120; // STT + LLM 합쳐 30초 내 끝나야 함, 여유

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const fp = await getVisitorFingerprint();
  const owned = (await sql`
    select id, target_sentence, korean_level::text as level
    from free_pronunciation_tests
    where id = ${id} and visitor_fingerprint = ${fp}
    limit 1
  `) as { id: string; target_sentence: string; level: string }[];
  if (!owned[0]) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const test = owned[0];

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
  const key = `free-pronunciation/${id}.${ext}`;

  const useMockUpload = process.env.MOCK_R2_UPLOAD === "true" || !process.env.R2_BUCKET;

  if (!useMockUpload) {
    await getR2().send(
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: contentType,
      })
    );
  }

  // DB에 R2 키만 저장 (URL은 다운로드 시 presign으로 발급)
  await sql`update free_pronunciation_tests set audio_url = ${key} where id = ${id}`;

  // 백그라운드 평가 — Vercel Fluid Compute가 응답 후에도 인스턴스 유지
  if (process.env.MOCK_AI_WORKER === "true" || !isAIConfigured()) {
    after(() => runMockEvaluation(id));
  } else {
    after(() =>
      runRealEvaluation({
        id,
        audioBytes: arrayBuffer,
        contentType,
        target: test.target_sentence,
        declaredLevel: test.level,
      })
    );
  }

  return NextResponse.json({ ok: true, key });
}

async function runRealEvaluation(input: {
  id: string;
  audioBytes: ArrayBuffer;
  contentType: string;
  target: string;
  declaredLevel: string;
}) {
  try {
    await sql`update free_pronunciation_tests set status='processing' where id = ${input.id}`;
    const r = await evaluatePronunciation({
      audioBytes: input.audioBytes,
      contentType: input.contentType,
      target: input.target,
      declaredLevel: input.declaredLevel,
    });
    await sql`
      update free_pronunciation_tests
      set status='completed',
          transcript = ${r.transcript},
          score = ${r.score},
          strengths = ${r.strengths},
          improvements = ${r.improvements},
          recommended_class_level = ${r.recommendedLevel}
      where id = ${input.id}
    `;
  } catch (e) {
    console.error("real evaluation failed:", e);
    await sql`update free_pronunciation_tests set status='failed' where id = ${input.id}`.catch(() => {});
  }
}

async function runMockEvaluation(id: string) {
  try {
    await sql`update free_pronunciation_tests set status='processing' where id = ${id}`;
    await new Promise((r) => setTimeout(r, 3000));
    const score = 70 + Math.floor(Math.random() * 25);
    const level =
      score >= 90 ? "advanced" : score >= 80 ? "intermediate" : score >= 70 ? "elementary" : "beginner";
    await sql`
      update free_pronunciation_tests
      set status='completed',
          transcript = target_sentence,
          score = ${score},
          strengths = ${"속도와 억양이 자연스러워요. 또박또박 잘 발음했어요. (Mock)"},
          improvements = ${"받침 발음을 조금 더 명확히 하면 좋아요. 'ㄴ/ㅁ/ㅇ' 구분을 신경 써보세요. (Mock)"},
          recommended_class_level = ${level}
      where id = ${id}
    `;
  } catch (e) {
    console.error("mock evaluation failed:", e);
    await sql`update free_pronunciation_tests set status='failed' where id = ${id}`.catch(() => {});
  }
}
