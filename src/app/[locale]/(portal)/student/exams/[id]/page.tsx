import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { SECTIONS } from "@/lib/exams/scoring";
import { StartButton } from "./start-button";

export default async function ExamIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await requireStudent();

  const rows = (await sql`
    select e.id::text, e.title, c.name as class_name, to_char(e.exam_date, 'YYYY-MM-DD') as date,
           e.w_listening, e.w_reading, e.w_grammar, e.w_writing, e.w_speaking,
           a.status as attempt_status
    from exams e
    join classes c on c.id = e.class_id
    join students s on s.id = ${student.studentId}::uuid
    left join exam_attempts a on a.exam_id = e.id and a.student_id = ${student.studentId}::uuid
    where e.id = ${id}::uuid and e.organization_id = ${student.organizationId}
      and e.status = 'published' and e.class_id = s.class_id
    limit 1
  `) as Array<{
    id: string;
    title: string;
    class_name: string;
    date: string;
    w_listening: number;
    w_reading: number;
    w_grammar: number;
    w_writing: number;
    w_speaking: number;
    attempt_status: string | null;
  }>;
  if (!rows[0]) notFound();
  const e = rows[0];
  if (e.attempt_status === "completed") redirect(`/student/exams/${id}/result`);

  const weights: Record<string, number> = {
    listening: e.w_listening,
    reading: e.w_reading,
    grammar_vocab: e.w_grammar,
    writing: e.w_writing,
    speaking: e.w_speaking,
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold">{e.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{e.class_name} · {e.date}</p>

      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <p className="text-sm font-bold">시험 구성 (총 100점)</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.key} className="flex justify-between">
              <span>{s.label}</span>
              <span className="font-semibold text-[var(--color-muted)]">{weights[s.key]}점</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          듣기·읽기·어휘문법은 객관식, 쓰기는 작문, 말하기는 녹음입니다. 순서대로 진행하며, 중간에 나가도 이어서 응시할 수 있습니다.
        </p>
      </div>

      <div className="mt-6">
        <StartButton examId={id} resume={e.attempt_status === "in_progress"} />
      </div>
    </div>
  );
}
