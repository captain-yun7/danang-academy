import { NextResponse, after } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { evaluatePronunciation, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { recomputeAttempt } from "@/lib/exams/grade";

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
  const examId = url.searchParams.get("examId");
  const questionId = url.searchParams.get("questionId");
  if (!examId || !questionId) return NextResponse.json({ error: "missing params" }, { status: 400 });

  // 본인 반의 게시된 시험 + 말하기 문항 확인
  const owned = (await sql`
    select q.id::text, q.prompt_ko, q.points
    from exam_questions q
    join exams e on e.id = q.exam_id
    join students s on s.id = ${student.studentId}::uuid
    where q.id = ${questionId}::uuid and q.exam_id = ${examId}::uuid and q.section = 'speaking'
      and e.organization_id = ${student.organizationId} and e.status = 'published' and e.class_id = s.class_id
    limit 1
  `) as { id: string; prompt_ko: string | null; points: number }[];
  if (!owned[0]) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const target = owned[0].prompt_ko ?? "";
  const maxPoints = owned[0].points;

  // 응시 확보
  await sql`
    insert into exam_attempts (exam_id, student_id, organization_id, status)
    values (${examId}::uuid, ${student.studentId}::uuid, ${student.organizationId}, 'in_progress')
    on conflict (exam_id, student_id) do nothing
  `;
  const attRows = (await sql`
    select id::text from exam_attempts where exam_id = ${examId}::uuid and student_id = ${student.studentId}::uuid limit 1
  `) as { id: string }[];
  const attemptId = attRows[0].id;

  const contentType = req.headers.get("content-type") || "audio/webm";
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > 5 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });

  const ext = contentType.includes("webm") ? "webm" : contentType.includes("mp4") ? "m4a" : contentType.includes("ogg") ? "ogg" : "bin";
  const key = `exam-speaking/${attemptId}/${questionId}.${ext}`;

  const useMockUpload = process.env.MOCK_R2_UPLOAD === "true" || !process.env.R2_BUCKET;
  if (!useMockUpload) {
    await getR2().send(
      new PutObjectCommand({ Bucket: r2Bucket(), Key: key, Body: new Uint8Array(buf), ContentType: contentType })
    );
  }

  await sql`
    insert into exam_answers (attempt_id, question_id, organization_id, audio_key, status)
    values (${attemptId}::uuid, ${questionId}::uuid, ${student.organizationId}, ${key}, 'processing')
    on conflict (attempt_id, question_id) do update set
      audio_key = excluded.audio_key, status = 'processing',
      awarded_points = null, ai_score = null, transcript = null, updated_at = now()
  `;

  const useMockAI = process.env.MOCK_AI_WORKER === "true" || !isAIConfigured();
  after(async () => {
    try {
      if (useMockAI) {
        const awarded = Math.round(maxPoints * 0.8);
        await sql`update exam_answers set status='graded', awarded_points=${awarded}, ai_score=${awarded},
                  transcript=${target}, updated_at=now()
                  where attempt_id=${attemptId}::uuid and question_id=${questionId}::uuid`;
      } else {
        const r = await evaluatePronunciation({ audioBytes: buf, contentType, target });
        const awarded = Math.max(0, Math.min(maxPoints, Math.round((r.totalScore / 100) * maxPoints)));
        const fb = [r.strengths, r.improvements].filter(Boolean).join(" / ");
        await sql`update exam_answers set status='graded', awarded_points=${awarded}, ai_score=${awarded},
                  transcript=${r.transcript}, ai_feedback=${fb}, updated_at=now()
                  where attempt_id=${attemptId}::uuid and question_id=${questionId}::uuid`;
      }
    } catch {
      await sql`update exam_answers set status='failed', updated_at=now()
                where attempt_id=${attemptId}::uuid and question_id=${questionId}::uuid`;
    }
    await recomputeAttempt(attemptId);
  });

  return NextResponse.json({ ok: true });
}
