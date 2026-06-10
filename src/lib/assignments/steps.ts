import { sql } from "@/lib/db/client";

/** 단계 유형 → 단계 번호 매핑 (word → phrase → sentence → passage 순서 고정) */
export const STEP_TYPES = [
  ["word", 1],
  ["phrase", 2],
  ["sentence", 3],
  ["passage", 4],
] as const;

export type StepType = (typeof STEP_TYPES)[number][0];

export const STEP_NO_BY_TYPE: Record<StepType, number> = Object.fromEntries(STEP_TYPES) as Record<
  StepType,
  number
>;

export type StepItem = {
  text: string;
  ttsKey: string | null;
  ttsStatus: "pending" | "ready" | "failed";
};

export type AssignmentStep = {
  id: string;
  assignmentId: string;
  stepNo: number;
  stepType: StepType;
  title: string | null;
  items: StepItem[];
  createdAt: string;
};

export type StepSubmissionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "submitted"
  | "graded";

export type StepSubmissionRow = {
  id: string;
  assignmentId: string;
  stepNo: number;
  studentId: string;
  organizationId: string;
  status: StepSubmissionStatus;
  audioKey: string | null;
  durationSec: number | null;
  transcript: string | null;
  accuracyScore: number | null;
  pronunciationScore: number | null;
  fluencyScore: number | null;
  completionScore: number | null;
  totalScore: number | null;
  strengths: string | null;
  improvements: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * 단계별 제출 결과를 assignment_submissions 1행으로 집계한다.
 * - 모든 단계 completed → status 'completed' + 평균 점수 + submitted_at
 * - 일부만 completed → status 'processing' + 현재까지 평균
 */
export async function recomputeAggregate(
  assignmentId: string,
  studentId: string,
  organizationId: string
): Promise<{ stepCount: number; completedCount: number; status: "completed" | "processing" }> {
  const rows = (await sql`
    select
      (select count(*)::int from assignment_steps where assignment_id = ${assignmentId}) as step_count,
      count(*)::int as completed_count,
      round(avg(total_score))::int as avg_total,
      round(avg(accuracy_score))::int as avg_accuracy,
      round(avg(pronunciation_score))::int as avg_pronunciation,
      round(avg(fluency_score))::int as avg_fluency,
      round(avg(completion_score))::int as avg_completion
    from assignment_step_submissions
    where assignment_id = ${assignmentId}
      and student_id = ${studentId}
      and organization_id = ${organizationId}
      and status = 'completed'
  `) as Array<{
    step_count: number;
    completed_count: number;
    avg_total: number | null;
    avg_accuracy: number | null;
    avg_pronunciation: number | null;
    avg_fluency: number | null;
    avg_completion: number | null;
  }>;
  const agg = rows[0];

  const allDone = agg.step_count > 0 && agg.completed_count >= agg.step_count;
  const status = allDone ? "completed" : "processing";
  const submittedAt = allDone ? new Date() : null;

  await sql`
    insert into assignment_submissions
      (assignment_id, student_id, organization_id, status,
       score, accuracy_score, pronunciation_score, fluency_score, completion_score,
       submitted_at, updated_at)
    values
      (${assignmentId}, ${studentId}, ${organizationId}, ${status},
       ${agg.avg_total}, ${agg.avg_accuracy}, ${agg.avg_pronunciation}, ${agg.avg_fluency}, ${agg.avg_completion},
       ${submittedAt}, now())
    on conflict (assignment_id, student_id) do update set
      status = excluded.status,
      score = excluded.score,
      accuracy_score = excluded.accuracy_score,
      pronunciation_score = excluded.pronunciation_score,
      fluency_score = excluded.fluency_score,
      completion_score = excluded.completion_score,
      submitted_at = coalesce(excluded.submitted_at, assignment_submissions.submitted_at),
      updated_at = now()
  `;

  return { stepCount: agg.step_count, completedCount: agg.completed_count, status };
}
