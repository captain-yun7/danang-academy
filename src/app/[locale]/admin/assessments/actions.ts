"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { generateParentComment } from "@/lib/assessments/comment";
import { type AreaScores, type GradeCuts } from "@/lib/assessments/scoring";

async function requireAdmin() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; organizationId?: string } | undefined;
  if (!u?.role || !u.organizationId || !["super_admin", "owner", "manager"].includes(u.role)) {
    throw new Error("forbidden");
  }
  return { userId: u.id ?? null, organizationId: u.organizationId };
}

async function getCuts(organizationId: string): Promise<GradeCuts> {
  const rows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${organizationId} limit 1
  `) as { excellent: number; good: number; normal: number }[];
  return rows[0] ?? { excellent: 90, good: 75, normal: 60 };
}

const optUuid = z.string().uuid().optional().or(z.literal(""));
const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pronunciationAssignmentId: optUuid,
  writingAssignmentId: optUuid,
});

// 연결할 과제가 본 org + 기대 type 인지 검증. 미선택('')이면 null 반환.
async function validateLinkedAssignment(
  assignmentId: string | undefined,
  type: "pronunciation" | "writing",
  organizationId: string
): Promise<string | null> {
  if (!assignmentId) return null;
  const rows = (await sql`
    select id::text from assignments
    where id = ${assignmentId}::uuid and organization_id = ${organizationId} and type = ${type}
    limit 1
  `) as { id: string }[];
  if (!rows[0]) throw new Error("invalid_assignment");
  return rows[0].id;
}

export async function createRound(input: z.infer<typeof createSchema>) {
  const { organizationId, userId } = await requireAdmin();
  const d = createSchema.parse(input);

  // 반이 본 org 소속인지 확인
  const cls = (await sql`
    select id::text from classes where id = ${d.classId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string }[];
  if (!cls[0]) throw new Error("invalid_class");

  const pronId = await validateLinkedAssignment(d.pronunciationAssignmentId || undefined, "pronunciation", organizationId);
  const writingId = await validateLinkedAssignment(d.writingAssignmentId || undefined, "writing", organizationId);

  const inserted = (await sql`
    insert into assessment_rounds
      (organization_id, class_id, title, assessment_date, created_by, pronunciation_assignment_id, writing_assignment_id)
    values
      (${organizationId}, ${d.classId}::uuid, ${d.title}, ${d.date}::date, ${userId}::uuid,
       ${pronId}::uuid, ${writingId}::uuid)
    returning id::text
  `) as { id: string }[];

  // 연결 과제가 있으면 생성 직후 1회 동기화
  if (pronId || writingId) {
    await syncRound(inserted[0].id, d.classId, organizationId, pronId, writingId);
  }

  revalidatePath("/admin/assessments");
  redirect(`/admin/assessments/${inserted[0].id}`);
}

const scoreNum = z.coerce.number().int().min(0).max(100).nullable();
const saveSchema = z.object({
  roundId: z.string().uuid(),
  rows: z.array(
    z.object({
      studentId: z.string().uuid(),
      listening: scoreNum,
      speaking: scoreNum,
      reading: scoreNum,
      writing: scoreNum,
      pronunciation: scoreNum,
    })
  ),
});

export async function saveScores(input: z.infer<typeof saveSchema>) {
  const { organizationId } = await requireAdmin();
  const d = saveSchema.parse(input);
  await assertRoundOrg(d.roundId, organizationId);

  for (const r of d.rows) {
    await sql`
      insert into assessment_scores
        (round_id, student_id, organization_id, listening_score, speaking_score, reading_score, writing_score, pronunciation_score)
      values
        (${d.roundId}::uuid, ${r.studentId}::uuid, ${organizationId},
         ${r.listening}, ${r.speaking}, ${r.reading}, ${r.writing}, ${r.pronunciation})
      on conflict (round_id, student_id) do update set
        listening_score = excluded.listening_score,
        speaking_score = excluded.speaking_score,
        reading_score = excluded.reading_score,
        writing_score = excluded.writing_score,
        pronunciation_score = excluded.pronunciation_score,
        updated_at = now()
    `;
  }
  revalidatePath(`/admin/assessments/${d.roundId}`);
  revalidatePath("/admin/assessments");
  return { ok: true };
}

// 회차에 연결된 발음/쓰기 과제 점수를 학생별로 동기화한다 (내부 — revalidate 안 함).
async function syncRound(
  roundId: string,
  classId: string,
  organizationId: string,
  pronId: string | null,
  writingId: string | null
): Promise<{ pronFilled: number; writingFilled: number }> {
  let pronFilled = 0;
  let writingFilled = 0;

  if (pronId) {
    const rows = (await sql`
      select s.id::text as student_id, sub.score
      from students s
      join assignment_submissions sub
        on sub.student_id = s.id and sub.assignment_id = ${pronId}::uuid
       and sub.status = 'completed' and sub.score is not null
      where s.class_id = ${classId}::uuid and s.organization_id = ${organizationId}
    `) as { student_id: string; score: number }[];
    for (const r of rows) {
      await sql`
        insert into assessment_scores (round_id, student_id, organization_id, pronunciation_score)
        values (${roundId}::uuid, ${r.student_id}::uuid, ${organizationId}, ${r.score})
        on conflict (round_id, student_id) do update set
          pronunciation_score = excluded.pronunciation_score, updated_at = now()
      `;
      pronFilled++;
    }
  }

  if (writingId) {
    const rows = (await sql`
      select s.id::text as student_id, sub.teacher_score
      from students s
      join assignment_submissions sub
        on sub.student_id = s.id and sub.assignment_id = ${writingId}::uuid
       and sub.status = 'graded' and sub.teacher_score is not null
      where s.class_id = ${classId}::uuid and s.organization_id = ${organizationId}
    `) as { student_id: string; teacher_score: number }[];
    for (const r of rows) {
      await sql`
        insert into assessment_scores (round_id, student_id, organization_id, writing_score)
        values (${roundId}::uuid, ${r.student_id}::uuid, ${organizationId}, ${r.teacher_score})
        on conflict (round_id, student_id) do update set
          writing_score = excluded.writing_score, updated_at = now()
      `;
      writingFilled++;
    }
  }

  return { pronFilled, writingFilled };
}

// 연결된 발음/쓰기 과제에서 점수를 다시 동기화한다.
export async function syncLinkedScores(roundId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(roundId);
  const round = await assertRoundOrg(roundId, organizationId);
  if (!round.pronunciation_assignment_id && !round.writing_assignment_id) {
    return { ok: true, pronFilled: 0, writingFilled: 0, linked: false };
  }
  const res = await syncRound(
    roundId,
    round.class_id,
    organizationId,
    round.pronunciation_assignment_id,
    round.writing_assignment_id
  );
  revalidatePath(`/admin/assessments/${roundId}`);
  return { ok: true, ...res, linked: true };
}

// 회차 전체 학생 코멘트 AI 일괄 생성
export async function generateComments(roundId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(roundId);
  await assertRoundOrg(roundId, organizationId);
  const cuts = await getCuts(organizationId);

  const rows = (await sql`
    select sc.id::text as score_id, st.name,
           sc.listening_score, sc.speaking_score, sc.reading_score, sc.writing_score, sc.pronunciation_score
    from assessment_scores sc
    join students st on st.id = sc.student_id
    where sc.round_id = ${roundId}::uuid and sc.organization_id = ${organizationId}
  `) as Array<{
    score_id: string;
    name: string;
    listening_score: number | null;
    speaking_score: number | null;
    reading_score: number | null;
    writing_score: number | null;
    pronunciation_score: number | null;
  }>;

  let count = 0;
  for (const r of rows) {
    const scores: AreaScores = {
      listening: r.listening_score,
      speaking: r.speaking_score,
      reading: r.reading_score,
      writing: r.writing_score,
      pronunciation: r.pronunciation_score,
    };
    const comment = await generateParentComment({ studentName: r.name, scores, cuts });
    await sql`update assessment_scores set parent_comment = ${comment}, updated_at = now()
              where id = ${r.score_id}::uuid and organization_id = ${organizationId}`;
    count++;
  }
  revalidatePath(`/admin/assessments/${roundId}`);
  return { ok: true, count };
}

const commentSchema = z.object({
  roundId: z.string().uuid(),
  studentId: z.string().uuid(),
  comment: z.string().trim().max(2000),
});

export async function saveComment(input: z.infer<typeof commentSchema>) {
  const { organizationId } = await requireAdmin();
  const d = commentSchema.parse(input);
  await assertRoundOrg(d.roundId, organizationId);
  await sql`
    insert into assessment_scores (round_id, student_id, organization_id, parent_comment)
    values (${d.roundId}::uuid, ${d.studentId}::uuid, ${organizationId}, ${d.comment})
    on conflict (round_id, student_id) do update set
      parent_comment = excluded.parent_comment, updated_at = now()
  `;
  revalidatePath(`/admin/assessments/${d.roundId}`);
  return { ok: true };
}

export async function deleteRound(roundId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(roundId);
  await assertRoundOrg(roundId, organizationId);
  // assessment_scores는 FK on delete cascade로 함께 삭제됨
  await sql`delete from assessment_rounds where id = ${roundId}::uuid and organization_id = ${organizationId}`;
  revalidatePath("/admin/assessments");
  redirect("/admin/assessments");
}

async function assertRoundOrg(roundId: string, organizationId: string) {
  const rows = (await sql`
    select id::text, class_id::text as class_id,
           pronunciation_assignment_id::text as pronunciation_assignment_id,
           writing_assignment_id::text as writing_assignment_id
    from assessment_rounds
    where id = ${roundId}::uuid and organization_id = ${organizationId} limit 1
  `) as {
    id: string;
    class_id: string;
    pronunciation_assignment_id: string | null;
    writing_assignment_id: string | null;
  }[];
  if (!rows[0]) throw new Error("not_found");
  return rows[0];
}
