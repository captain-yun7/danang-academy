import { NextResponse, after } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { evaluatePronunciation, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { recomputeResult } from "@/lib/exams/grade";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let student;
  try { student = await requireStudent(); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }

  const url = new URL(req.url);
  const testId = url.searchParams.get("testId");
  const questionId = url.searchParams.get("questionId");
  if (!testId || !questionId) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const owned = (await sql`
    select q.id::text, q.question_text, q.points
    from weekly_questions q
    join weekly_tests t on t.id = q.test_id
    join students s on s.id = ${student.studentId}::uuid
    where q.id = ${questionId}::uuid and q.test_id = ${testId}::uuid and q.skill = 'speaking'
      and t.organization_id = ${student.organizationId} and t.status = 'published' and t.class_id = s.class_id limit 1
  `) as { id: string; question_text: string | null; points: number }[];
  if (!owned[0]) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const target = owned[0].question_text ?? "";
  const maxPoints = owned[0].points;

  await sql`insert into weekly_results (test_id, student_id, organization_id, status)
            values (${testId}::uuid, ${student.studentId}::uuid, ${student.organizationId}, 'doing')
            on conflict (test_id, student_id) do nothing`;

  const contentType = req.headers.get("content-type") || "audio/webm";
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > 5 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
  const ext = contentType.includes("webm") ? "webm" : contentType.includes("mp4") ? "m4a" : contentType.includes("ogg") ? "ogg" : "bin";
  const key = `weekly-speaking/${testId}/${student.studentId}-${questionId}.${ext}`;

  const useMockUpload = process.env.MOCK_R2_UPLOAD === "true" || !process.env.R2_BUCKET;
  if (!useMockUpload) {
    await getR2().send(new PutObjectCommand({ Bucket: r2Bucket(), Key: key, Body: new Uint8Array(buf), ContentType: contentType }));
  }

  await sql`
    insert into weekly_answers (test_id, question_id, student_id, organization_id, audio_answer_url, status)
    values (${testId}::uuid, ${questionId}::uuid, ${student.studentId}::uuid, ${student.organizationId}, ${key}, 'processing')
    on conflict (test_id, question_id, student_id) do update set
      audio_answer_url = excluded.audio_answer_url, status = 'processing',
      final_score = null, ai_score = null, transcript = null, updated_at = now()`;

  const useMockAI = process.env.MOCK_AI_WORKER === "true" || !isAIConfigured();
  after(async () => {
    try {
      if (useMockAI) {
        const awarded = Math.round(maxPoints * 0.8);
        await sql`update weekly_answers set status='graded', ai_score=${awarded}, final_score=${awarded}, transcript=${target}, updated_at=now()
                  where test_id=${testId}::uuid and question_id=${questionId}::uuid and student_id=${student.studentId}::uuid`;
      } else {
        const r = await evaluatePronunciation({ audioBytes: buf, contentType, target });
        const awarded = Math.max(0, Math.min(maxPoints, Math.round((r.totalScore / 100) * maxPoints)));
        const fb = [r.strengths, r.improvements].filter(Boolean).join(" / ");
        await sql`update weekly_answers set status='graded', ai_score=${awarded}, final_score=${awarded}, transcript=${r.transcript}, ai_feedback=${fb}, updated_at=now()
                  where test_id=${testId}::uuid and question_id=${questionId}::uuid and student_id=${student.studentId}::uuid`;
      }
    } catch {
      await sql`update weekly_answers set status='failed', updated_at=now()
                where test_id=${testId}::uuid and question_id=${questionId}::uuid and student_id=${student.studentId}::uuid`;
    }
    await recomputeResult(testId, student.studentId, student.organizationId);
  });

  return NextResponse.json({ ok: true });
}
