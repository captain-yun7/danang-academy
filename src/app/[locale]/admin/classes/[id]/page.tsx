import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { ClassForm } from "../class-form";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = (await sql`
    select c.id::text, c.name, c.level::text, c.teacher_id::text,
           c.schedule, c.capacity
    from classes c where c.id = ${id} limit 1
  `) as Array<{
    id: string;
    name: string;
    level: string;
    teacher_id: string | null;
    schedule: string | null;
    capacity: number;
  }>;
  if (!rows[0]) notFound();
  const c = rows[0];

  const teachers = (await sql`
    select id::text, name from users
    where role in ('teacher','manager','owner','super_admin')
    order by name
  `) as { id: string; name: string }[];

  const students = (await sql`
    select id::text, name, korean_level::text from students
    where class_id = ${id}
    order by name
  `) as { id: string; name: string; korean_level: string | null }[];

  return (
    <div>
      <Link
        href="/admin/classes"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← 반 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">반 정보 수정</h2>
          <ClassForm
            mode="edit"
            teachers={teachers}
            initial={{
              id: c.id,
              name: c.name,
              level: c.level,
              teacherId: c.teacher_id,
              schedule: c.schedule,
              capacity: c.capacity,
            }}
          />
        </section>

        <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            배정 학생 ({students.length} / {c.capacity})
          </p>
          {students.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              아직 배정된 학생이 없어요. 학생 페이지에서 이 반으로 배정하세요.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="hover:text-[var(--color-primary-deep)]"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
