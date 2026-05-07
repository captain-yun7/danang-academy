import { sql } from "@/lib/db/client";
import { StudentForm } from "../student-form";

export default async function NewStudentPage() {
  const classes = (await sql`
    select id::text, name, level::text from classes order by name
  `) as { id: string; name: string; level: string }[];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Students
      </p>
      <h1 className="mt-1 text-2xl font-bold">새 학생 등록</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        등록하면 QR 토큰이 자동으로 발급됩니다.
      </p>

      <div className="mt-6 max-w-xl rounded-xl border border-[var(--color-line)] bg-white p-6">
        <StudentForm mode="create" classes={classes} />
      </div>
    </div>
  );
}
