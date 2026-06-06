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
      and (a.class_id is null or a.class_id = st.class_id)
    order by a.created_at desc
  `) as StudentAssignmentRow[];
}

export type StudentAssignmentDetail = {
  id: string;
  type: string;
  title: string;
  instructions: string | null;
  target_text: string | null;
  ttsUrl: string | null;
  due_date: string | null;
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
      and (a.class_id is null or a.class_id = st.class_id)
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

  const ttsUrl =
    a.type === "pronunciation" && a.tts_status === "ready" && a.tts_audio_key
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
      and (a.class_id is null or a.class_id = st.class_id)
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
