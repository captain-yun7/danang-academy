import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};

type Row = {
  id: string;
  name: string;
  level: string;
  schedule: string | null;
  capacity: number;
  teacher_name: string | null;
  student_count: number;
};

export default async function AdminClassesPage() {
  const classes = (await sql`
    select c.id::text, c.name, c.level::text, c.schedule, c.capacity,
           u.name as teacher_name,
           (select count(*)::int from students s where s.class_id = c.id) as student_count
    from classes c
    left join users u on u.id = c.teacher_id
    order by case c.level
      when 'beginner' then 1
      when 'elementary' then 2
      when 'intermediate' then 3
      when 'advanced' then 4
    end, c.created_at
  `) as Row[];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Classes
          </p>
          <h1 className="mt-1 text-2xl font-bold">반 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            총 {classes.length}개 반
          </p>
        </div>
        <Link
          href="/admin/classes/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          + 새 반 개설
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            아직 개설된 반이 없어요.
          </p>
          <Link
            href="/admin/classes/new"
            className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
          >
            첫 반 만들기 →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-[var(--color-line)] bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-deep)]">
                    {LEVEL_LABEL[c.level] ?? c.level}
                  </p>
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="mt-1 block truncate text-base font-bold hover:text-[var(--color-primary-deep)]"
                  >
                    {c.name}
                  </Link>
                  {c.schedule && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      📅 {c.schedule}
                    </p>
                  )}
                  {c.teacher_name && (
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      👨‍🏫 {c.teacher_name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">
                    {c.student_count}
                    <span className="text-sm text-[var(--color-muted)]">/{c.capacity}</span>
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">학생</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
