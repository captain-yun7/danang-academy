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

const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createRound(input: z.infer<typeof createSchema>) {
  const { organizationId, userId } = await requireAdmin();
  const d = createSchema.parse(input);

  // 반이 본 org 소속인지 확인
  const cls = (await sql`
    select id::text from classes where id = ${d.classId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string }[];
  if (!cls[0]) throw new Error("invalid_class");

  const inserted = (await sql`
    insert into assessment_rounds (organization_id, class_id, title, assessment_date, created_by)
    values (${organizationId}, ${d.classId}::uuid, ${d.title}, ${d.date}::date, ${userId}::uuid)
    returning id::text
  `) as { id: string }[];

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

// 회차 대상 반 학생들의 최근 발음 과제 점수를 가져와 pronunciation_score에 채운다.
export async function pullPronunciation(roundId: string) {
  const { organizationId } = await requireAdmin();
  z.string().uuid().parse(roundId);
  const round = await assertRoundOrg(roundId, organizationId);

  const rows = (await sql`
    select s.id::text as student_id, latest.score
    from students s
    left join lateral (
      select sub.score
      from assignment_submissions sub
      join assignments a on a.id = sub.assignment_id
      where sub.student_id = s.id
        and sub.organization_id = ${organizationId}
        and a.type = 'pronunciation'
        and sub.status = 'completed'
        and sub.score is not null
      order by coalesce(sub.graded_at, sub.submitted_at, sub.updated_at) desc
      limit 1
    ) latest on true
    where s.class_id = ${round.class_id}::uuid and s.organization_id = ${organizationId}
  `) as { student_id: string; score: number | null }[];

  let filled = 0;
  for (const r of rows) {
    if (r.score === null) continue;
    await sql`
      insert into assessment_scores (round_id, student_id, organization_id, pronunciation_score)
      values (${roundId}::uuid, ${r.student_id}::uuid, ${organizationId}, ${r.score})
      on conflict (round_id, student_id) do update set
        pronunciation_score = excluded.pronunciation_score, updated_at = now()
    `;
    filled++;
  }
  revalidatePath(`/admin/assessments/${roundId}`);
  return { ok: true, filled };
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

async function assertRoundOrg(roundId: string, organizationId: string) {
  const rows = (await sql`
    select id::text, class_id::text as class_id from assessment_rounds
    where id = ${roundId}::uuid and organization_id = ${organizationId} limit 1
  `) as { id: string; class_id: string }[];
  if (!rows[0]) throw new Error("not_found");
  return rows[0];
}
