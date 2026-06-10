import { NextResponse, after } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getR2, r2Bucket } from "@/lib/r2/client";
import { evaluatePronunciation, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { recomputeAggregate, type StepItem } from "@/lib/assignments/steps";

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
  const stepNo = Number(url.searchParams.get("stepNo"));
  if (!Number.isInteger(stepNo) || stepNo < 1 || stepNo > 4) {
    return NextResponse.json({ error: "invalid stepNo" }, { status: 400 });
  }
  const rawDuration = Number(url.searchParams.get("durationSec"));
  const durationSec = Number.isFinite(rawDuration)
    ? Math.min(Math.max(Math.round(rawDuration), 0), 120)
    : 0;

  // 과제가 본인 대상 발음 과제인지 + 해당 단계가 존재하는지 확인
  const owned = (await sql`
    select a.id::text, s.step_type, s.items
    from assignments a
    join assignment_steps s on s.assignment_id = a.id and s.step_no = ${stepNo}
    left join students st on st.id = ${student.studentId}
    where a.id = ${assignmentId}
      and a.organization_id = ${student.organizationId}
      and a.type = 'pronunciation' and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${student.studentId}))
      )
    limit 1
  `) as { id: string; step_type: string; items: StepItem[] }[];
  if (!owned[0]) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // 단계의 목표 텍스트 = 항목 텍스트 결합 (passage는 단일 항목)
  const target = (owned[0].items ?? [])
    .map((it) => it.text)
    .filter(Boolean)
    .join("\n");

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
  const key = `assignment-step-submissions/${assignmentId}/${student.studentId}-step${stepNo}.${ext}`;

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

  // 단계 제출 upsert — 재녹음 시 처리 상태로 리셋 + 새 오디오로 교체
  const subRows = (await sql`
    insert into assignment_step_submissions
      (assignment_id, step_no, student_id, organization_id, status,
       audio_key, duration_sec, submitted_at, updated_at)
    values
      (${assignmentId}, ${stepNo}, ${student.studentId}, ${student.organizationId}, 'processing',
       ${key}, ${durationSec}, now(), now())
    on conflict (assignment_id, step_no, student_id) do update set
      status = 'processing',
      audio_key = excluded.audio_key,
      duration_sec = excluded.duration_sec,
      transcript = null,
      accuracy_score = null, pronunciation_score = null,
      fluency_score = null, completion_score = null, total_score = null,
      strengths = null, improvements = null,
      submitted_at = now(), updated_at = now()
    returning id::text
  `) as { id: string }[];
  const stepSubmissionId = subRows[0].id;

  const evalContext = {
    stepSubmissionId,
    assignmentId,
    studentId: student.studentId,
    organizationId: student.organizationId,
  };
  if (process.env.MOCK_AI_WORKER === "true" || !isAIConfigured()) {
    after(() => runMockEvaluation(evalContext));
  } else {
    after(() =>
      runRealEvaluation({ ...evalContext, audioBytes: arrayBuffer, contentType, target })
    );
  }

  return NextResponse.json({ ok: true, stepSubmissionId });
}

type EvalContext = {
  stepSubmissionId: string;
  assignmentId: string;
  studentId: string;
  organizationId: string;
};

async function runRealEvaluation(
  input: EvalContext & { audioBytes: ArrayBuffer; contentType: string; target: string }
) {
  try {
    const r = await evaluatePronunciation({
      audioBytes: input.audioBytes,
      contentType: input.contentType,
      target: input.target,
      feedbackLocale: "vi",
    });
    await sql`
      update assignment_step_submissions
      set status='completed', transcript=${r.transcript},
          accuracy_score=${r.accuracyScore}, pronunciation_score=${r.pronunciationScore},
          fluency_score=${r.fluencyScore}, completion_score=${r.completionScore},
          total_score=${r.totalScore},
          strengths=${r.strengths}, improvements=${r.improvements}, updated_at=now()
      where id = ${input.stepSubmissionId}
    `;
    await recomputeAggregate(input.assignmentId, input.studentId, input.organizationId);
  } catch (e) {
    console.error("step evaluation failed:", e);
    await sql`update assignment_step_submissions set status='failed', updated_at=now() where id = ${input.stepSubmissionId}`.catch(
      () => {}
    );
  }
}

async function runMockEvaluation(input: EvalContext) {
  try {
    await new Promise((r) => setTimeout(r, 3000));
    // 합이 정확히 total이 되는 그럴듯한 세부 점수 분배
    const accuracy = 28 + Math.floor(Math.random() * 11); // 28~38 / 40
    const pronunciation = 21 + Math.floor(Math.random() * 8); // 21~28 / 30
    const fluency = 14 + Math.floor(Math.random() * 6); // 14~19 / 20
    const completion = 7 + Math.floor(Math.random() * 3); // 7~9 / 10
    const total = accuracy + pronunciation + fluency + completion;
    await sql`
      update assignment_step_submissions
      set status='completed',
          transcript = ${"(Mock) 발음 인식 결과"},
          accuracy_score = ${accuracy}, pronunciation_score = ${pronunciation},
          fluency_score = ${fluency}, completion_score = ${completion},
          total_score = ${total},
          strengths = ${"Tốc độ và ngữ điệu tự nhiên. (Mock)"},
          improvements = ${"Phát âm patchim cần rõ hơn. (Mock)"},
          updated_at = now()
      where id = ${input.stepSubmissionId}
    `;
    await recomputeAggregate(input.assignmentId, input.studentId, input.organizationId);
  } catch (e) {
    console.error("mock step evaluation failed:", e);
    await sql`update assignment_step_submissions set status='failed', updated_at=now() where id = ${input.stepSubmissionId}`.catch(
      () => {}
    );
  }
}
