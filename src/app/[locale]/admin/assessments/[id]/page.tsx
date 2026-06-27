import { notFound } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { DEFAULT_CUTS, type AreaScores, type GradeCuts } from "@/lib/assessments/scoring";
import { RoundDetail, type RoundStudent } from "./round-detail";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rounds = (await sql`
    select r.id::text, r.title, r.class_id::text,
           c.name as class_name,
           to_char(r.assessment_date, 'YYYY-MM-DD') as date
    from assessment_rounds r
    join classes c on c.id = r.class_id
    where r.id = ${id}::uuid and r.organization_id = ${orgId}
    limit 1
  `) as { id: string; title: string; class_id: string; class_name: string; date: string }[];
  if (!rounds[0]) notFound();
  const round = rounds[0];

  const cutRows = (await sql`
    select grade_cut_excellent as excellent, grade_cut_good as good, grade_cut_normal as normal
    from organizations where id = ${orgId} limit 1
  `) as GradeCuts[];
  const cuts: GradeCuts = cutRows[0] ?? DEFAULT_CUTS;

  // 반 학생 명단 + 점수 (left join)
  const roster = (await sql`
    select s.id::text, s.name, s.student_code,
           sc.listening_score, sc.speaking_score, sc.reading_score, sc.writing_score, sc.pronunciation_score,
           sc.parent_comment
    from students s
    left join assessment_scores sc
      on sc.student_id = s.id and sc.round_id = ${id}::uuid
    where s.class_id = ${round.class_id}::uuid and s.organization_id = ${orgId}
    order by s.name
  `) as Array<{
    id: string;
    name: string;
    student_code: string | null;
    listening_score: number | null;
    speaking_score: number | null;
    reading_score: number | null;
    writing_score: number | null;
    pronunciation_score: number | null;
    parent_comment: string | null;
  }>;

  const students: RoundStudent[] = roster.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.student_code,
    scores: {
      listening: r.listening_score,
      speaking: r.speaking_score,
      reading: r.reading_score,
      writing: r.writing_score,
      pronunciation: r.pronunciation_score,
    } as AreaScores,
    hasComment: !!r.parent_comment,
  }));

  return (
    <RoundDetail
      roundId={round.id}
      title={round.title}
      className={round.class_name}
      date={round.date}
      students={students}
      cuts={cuts}
    />
  );
}
