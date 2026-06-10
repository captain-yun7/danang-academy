"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { presignGet } from "@/lib/r2/presign";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function studentSignIn(input: {
  studentCode: string;
  password: string;
  callbackUrl?: string;
}): Promise<{ error?: string } | void> {
  try {
    await signIn("student", {
      studentCode: input.studentCode,
      password: input.password,
      redirectTo: input.callbackUrl ?? "/student",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.type };
    }
    throw err;
  }
}

export async function studentSignOut() {
  await signOut({ redirectTo: "/student/login" });
}

// 학생 본인이 받는 과제 = 미배정(학원 전체) 또는 본인 반에 배정된 활성 과제
export type StudentAssignmentRow = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  status: string | null; // 제출물 상태 (null = 미시작)
  score: number | null;
  teacher_score: number | null;
};

export async function getMyAssignments(): Promise<StudentAssignmentRow[]> {
  const { studentId, organizationId } = await requireStudent();
  return (await sql`
    select a.id::text, a.type::text, a.title,
           to_char(a.due_date, 'YYYY-MM-DD') as due_date,
           sub.status::text as status, sub.score, sub.teacher_score
    from assignments a
    left join students st on st.id = ${studentId}
    left join assignment_submissions sub
      on sub.assignment_id = a.id and sub.student_id = ${studentId}
    where a.organization_id = ${organizationId}
      and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${studentId}))
      )
    order by a.created_at desc
  `) as StudentAssignmentRow[];
}

export type StudentStepItem = {
  text: string;
  ttsKey: string | null;
  ttsStatus: "pending" | "ready" | "failed";
};

export type StudentStep = {
  stepNo: number;
  stepType: "word" | "phrase" | "sentence" | "passage";
  title: string | null;
  items: StudentStepItem[];
};

export type StudentStepSubmission = {
  step_no: number;
  status: string;
  total_score: number | null;
  accuracy_score: number | null;
  pronunciation_score: number | null;
  fluency_score: number | null;
  completion_score: number | null;
  transcript: string | null;
  strengths: string | null;
  improvements: string | null;
};

export type StudentAssignmentDetail = {
  id: string;
  type: string;
  title: string;
  instructions: string | null;
  target_text: string | null;
  ttsUrl: string | null;
  due_date: string | null;
  steps: StudentStep[];
  stepSubmissions: StudentStepSubmission[];
  submission: {
    id: string;
    status: string;
    score: number | null;
    strengths: string | null;
    improvements: string | null;
    transcript: string | null;
    submission_text: string | null;
    teacher_score: number | null;
    teacher_comment: string | null;
  } | null;
};

export async function getMyAssignmentDetail(
  assignmentId: string
): Promise<StudentAssignmentDetail | null> {
  const { studentId, organizationId } = await requireStudent();
  const rows = (await sql`
    select a.id::text, a.type::text, a.title, a.instructions, a.target_text,
           a.tts_audio_key, a.tts_status,
           to_char(a.due_date, 'YYYY-MM-DD') as due_date
    from assignments a
    left join students st on st.id = ${studentId}
    where a.id = ${assignmentId}
      and a.organization_id = ${organizationId}
      and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${studentId}))
      )
    limit 1
  `) as {
    id: string;
    type: string;
    title: string;
    instructions: string | null;
    target_text: string | null;
    tts_audio_key: string | null;
    tts_status: string | null;
    due_date: string | null;
  }[];
  if (!rows[0]) return null;
  const a = rows[0];

  const subs = (await sql`
    select id::text, status::text, score, strengths, improvements, transcript,
           submission_text, teacher_score, teacher_comment
    from assignment_submissions
    where assignment_id = ${assignmentId} and student_id = ${studentId}
    limit 1
  `) as StudentAssignmentDetail["submission"][];

  // 단계형 발음 과제 — 단계 목록 + 본인 단계별 제출
  let steps: StudentStep[] = [];
  let stepSubmissions: StudentStepSubmission[] = [];
  if (a.type === "pronunciation") {
    const stepRows = (await sql`
      select step_no, step_type, title, items
      from assignment_steps
      where assignment_id = ${assignmentId}
      order by step_no
    `) as { step_no: number; step_type: StudentStep["stepType"]; title: string | null; items: StudentStepItem[] }[];
    steps = stepRows.map((r) => ({
      stepNo: r.step_no,
      stepType: r.step_type,
      title: r.title,
      items: r.items ?? [],
    }));
    if (steps.length > 0) {
      stepSubmissions = (await sql`
        select step_no, status::text, total_score, accuracy_score, pronunciation_score,
               fluency_score, completion_score, transcript, strengths, improvements
        from assignment_step_submissions
        where assignment_id = ${assignmentId} and student_id = ${studentId}
        order by step_no
      `) as StudentStepSubmission[];
    }
  }

  const ttsUrl =
    (a.type === "pronunciation" || a.type === "listening") &&
    a.tts_status === "ready" &&
    a.tts_audio_key
      ? await presignGet(a.tts_audio_key, 60 * 30)
      : null;

  return {
    id: a.id,
    type: a.type,
    title: a.title,
    instructions: a.instructions,
    target_text: a.target_text,
    ttsUrl,
    due_date: a.due_date,
    steps,
    stepSubmissions,
    submission: subs[0] ?? null,
  };
}

// 발음 제출 결과 폴링용 (가벼운 조회)
export type MySubmissionResult = {
  status: string;
  score: number | null;
  strengths: string | null;
  improvements: string | null;
  transcript: string | null;
} | null;

export async function getMySubmission(assignmentId: string): Promise<MySubmissionResult> {
  const { studentId, organizationId } = await requireStudent();
  const rows = (await sql`
    select status::text, score, strengths, improvements, transcript
    from assignment_submissions
    where assignment_id = ${assignmentId} and student_id = ${studentId}
      and organization_id = ${organizationId}
    limit 1
  `) as NonNullable<MySubmissionResult>[];
  return rows[0] ?? null;
}

// 단계 제출 결과 폴링용 (가벼운 조회)
export type MyStepSubmissionResult = {
  status: string;
  total_score: number | null;
  accuracy_score: number | null;
  pronunciation_score: number | null;
  fluency_score: number | null;
  completion_score: number | null;
  transcript: string | null;
  strengths: string | null;
  improvements: string | null;
} | null;

export async function getMyStepSubmission(
  assignmentId: string,
  stepNo: number
): Promise<MyStepSubmissionResult> {
  const { studentId, organizationId } = await requireStudent();
  if (!Number.isInteger(stepNo) || stepNo < 1 || stepNo > 4) return null;
  const rows = (await sql`
    select status::text, total_score, accuracy_score, pronunciation_score,
           fluency_score, completion_score, transcript, strengths, improvements
    from assignment_step_submissions
    where assignment_id = ${assignmentId} and step_no = ${stepNo}
      and student_id = ${studentId} and organization_id = ${organizationId}
    limit 1
  `) as NonNullable<MyStepSubmissionResult>[];
  return rows[0] ?? null;
}

// 듣기 과제 완료 처리
export async function markListened(assignmentId: string) {
  const { studentId, organizationId } = await requireStudent();

  const ok = (await sql`
    select a.id from assignments a
    left join students st on st.id = ${studentId}
    where a.id = ${assignmentId} and a.organization_id = ${organizationId}
      and a.type = 'listening' and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${studentId}))
      )
    limit 1
  `) as { id: string }[];
  if (!ok[0]) throw new Error("forbidden");

  await sql`
    insert into assignment_submissions
      (assignment_id, student_id, organization_id, status, listened_at, submitted_at, updated_at)
    values
      (${assignmentId}, ${studentId}, ${organizationId}, 'completed', now(), now(), now())
    on conflict (assignment_id, student_id) do update set
      status = 'completed',
      listened_at = now(),
      submitted_at = now(),
      updated_at = now()
  `;
  revalidatePath(`/student/assignments/${assignmentId}`);
  revalidatePath("/student");
}

// 단계 항목별 모범음성 presigned URL — 학생이 접근 가능한 과제의 TTS 키만 허용
export async function getStepItemTtsUrl(
  assignmentId: string,
  ttsKey: string
): Promise<string | null> {
  const { studentId, organizationId } = await requireStudent();
  if (!ttsKey.startsWith(`assignment-tts/${assignmentId}/`)) return null;

  const ok = (await sql`
    select a.id from assignments a
    left join students st on st.id = ${studentId}
    where a.id = ${assignmentId} and a.organization_id = ${organizationId}
      and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${studentId}))
      )
    limit 1
  `) as { id: string }[];
  if (!ok[0]) return null;

  return presignGet(ttsKey, 60 * 30);
}

const writingSchema = z.object({
  assignmentId: z.string().uuid(),
  text: z.string().trim().min(1).max(5000),
});

export async function submitWriting(input: z.infer<typeof writingSchema>) {
  const { studentId, organizationId } = await requireStudent();
  const parsed = writingSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 과제가 본인 대상 쓰기 과제인지 확인
  const ok = (await sql`
    select a.id from assignments a
    left join students st on st.id = ${studentId}
    where a.id = ${d.assignmentId} and a.organization_id = ${organizationId}
      and a.type = 'writing' and a.active = true
      and (
        a.target_type = 'all'
        or (a.target_type = 'class' and a.class_id = st.class_id)
        or (a.target_type = 'students' and exists (
          select 1 from assignment_targets tg
          where tg.assignment_id = a.id and tg.student_id = ${studentId}))
      )
    limit 1
  `) as { id: string }[];
  if (!ok[0]) throw new Error("forbidden");

  await sql`
    insert into assignment_submissions
      (assignment_id, student_id, organization_id, status, submission_text, submitted_at, updated_at)
    values
      (${d.assignmentId}, ${studentId}, ${organizationId}, 'submitted', ${d.text}, now(), now())
    on conflict (assignment_id, student_id) do update set
      submission_text = excluded.submission_text,
      status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  `;
  revalidatePath(`/student/assignments/${d.assignmentId}`);
  revalidatePath("/student");
}
