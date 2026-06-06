import { NextResponse, after } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { evaluatePronunciation, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let student;
  try {
    student = await requireStudent();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "missing assignmentId" }, { status: 400 });
  }

  // 과제가 본인 대상 발음 과제인지 확인 + 목표 문장 확보
  const owned = (await sql`
    select a.id::text, a.target_text
    from assignments a
    left join students st on st.id = ${student.studentId}
    where a.id = ${assignmentId}
      and a.organization_id = ${student.organizationId}
      and a.type = 'pronunciation' and a.active = true
      and (a.class_id is null or a.class_id = st.class_id)
    limit 1
  `) as { id: string; target_text: string | null }[];
  if (!owned[0]) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const target = owned[0].target_text ?? "";

  const contentType = req.headers.get("content-type") || "audio/webm";
  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  // 제출 레코드 upsert → submission id 확보 (학생 1명당 과제 1행)
  const subRows = (await sql`
    insert into assignment_submissions
      (assignment_id, student_id, organization_id, status, submitted_at, updated_at)
    values
      (${assignmentId}, ${student.studentId}, ${student.organizationId}, 'pending', now(), now())
    on conflict (assignment_id, student_id) do update set
      status = 'pending', submitted_at = now(), updated_at = now()
    returning id::text
  `) as { id: string }[];
  const submissionId = subRows[0].id;

  const ext = contentType.includes("webm")
    ? "webm"
    : contentType.includes("mp4")
      ? "m4a"
      : contentType.includes("ogg")
        ? "ogg"
        : "bin";
  const key = `assignment-submissions/${submissionId}.${ext}`;

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

  await sql`update assignment_submissions set audio_key = ${key}, updated_at = now() where id = ${submissionId}`;

  if (process.env.MOCK_AI_WORKER === "true" || !isAIConfigured()) {
    after(() => runMockEvaluation(submissionId));
  } else {
    after(() =>
      runRealEvaluation({ submissionId, audioBytes: arrayBuffer, contentType, target })
    );
  }

  return NextResponse.json({ ok: true, submissionId });
}

async function runRealEvaluation(input: {
  submissionId: string;
  audioBytes: ArrayBuffer;
  contentType: string;
  target: string;
}) {
  try {
    await sql`update assignment_submissions set status='processing', updated_at=now() where id = ${input.submissionId}`;
    const r = await evaluatePronunciation({
      audioBytes: input.audioBytes,
      contentType: input.contentType,
      target: input.target,
      feedbackLocale: "vi",
    });
    await sql`
      update assignment_submissions
      set status='completed', transcript=${r.transcript}, score=${r.score},
          strengths=${r.strengths}, improvements=${r.improvements}, updated_at=now()
      where id = ${input.submissionId}
    `;
  } catch (e) {
    console.error("assignment evaluation failed:", e);
    await sql`update assignment_submissions set status='failed', updated_at=now() where id = ${input.submissionId}`.catch(
      () => {}
    );
  }
}

async function runMockEvaluation(submissionId: string) {
  try {
    await sql`update assignment_submissions set status='processing', updated_at=now() where id = ${submissionId}`;
    await new Promise((r) => setTimeout(r, 3000));
    const score = 70 + Math.floor(Math.random() * 25);
    await sql`
      update assignment_submissions
      set status='completed',
          transcript = ${"(Mock) 발음 인식 결과"},
          score = ${score},
          strengths = ${"Tốc độ và ngữ điệu tự nhiên. (Mock)"},
          improvements = ${"Phát âm patchim cần rõ hơn. (Mock)"},
          updated_at = now()
      where id = ${submissionId}
    `;
  } catch (e) {
    console.error("mock assignment evaluation failed:", e);
    await sql`update assignment_submissions set status='failed', updated_at=now() where id = ${submissionId}`.catch(
      () => {}
    );
  }
}
