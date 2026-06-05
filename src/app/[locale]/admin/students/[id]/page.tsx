import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { StudentForm } from "../student-form";
import { NotesSection, type StudentNote } from "../notes/notes-section";

type LevelKey = "beginner" | "elementary" | "intermediate" | "advanced";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const rows = (await sql`
    select s.id::text, s.name, s.phone,
           s.native_language::text,
           s.korean_level::text,
           s.class_id::text,
           s.parent_contact,
           s.student_code,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           s.status::text,
           c.name as class_name
    from students s
    left join classes c on c.id = s.class_id
    where s.id = ${id} and s.organization_id = ${orgId}
    limit 1
  `) as Array<{
    id: string;
    name: string;
    phone: string | null;
    native_language: string;
    korean_level: string | null;
    class_id: string | null;
    parent_contact: string | null;
    student_code: string | null;
    enrolled_at: string | null;
    status: string;
    class_name: string | null;
  }>;
  if (!rows[0]) notFound();
  const s = rows[0];

  const classes = (await sql`
    select id::text, name, level::text from classes
    where organization_id = ${orgId}
    order by name
  `) as { id: string; name: string; level: string }[];

  const recentLogs = (await sql`
    select kind::text, to_char(logged_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as ts
    from attendance_logs
    where student_id = ${id} and organization_id = ${orgId}
    order by logged_at desc
    limit 20
  `) as { kind: string; ts: string }[];

  const notes = (await sql`
    select n.id::text, n.content, n.category, n.author_id::text,
           u.name as author_name,
           to_char(n.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from student_notes n
    left join users u on u.id = n.author_id
    where n.student_id = ${id} and n.organization_id = ${orgId}
    order by n.created_at desc
    limit 50
  `) as StudentNote[];

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const currentRole = (session?.user as { role?: string } | undefined)?.role ?? "teacher";

  const t = await getTranslations("admin.students.detail");
  const tList = await getTranslations("admin.students");
  const tLevel = await getTranslations("admin.students.level");

  return (
    <div>
      <Link
        href="/admin/students"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {tList("backToList")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{s.name}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {s.student_code ? `${s.student_code} · ` : ""}
        {s.class_name ? `${s.class_name} · ` : ""}
        {s.korean_level ? tLevel(s.korean_level as LevelKey) : t("levelUndefined")}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">{t("editTitle")}</h2>
          <StudentForm
            mode="edit"
            classes={classes}
            initial={{
              id: s.id,
              name: s.name,
              phone: s.phone,
              nativeLanguage: s.native_language,
              koreanLevel: s.korean_level,
              classId: s.class_id,
              parentContact: s.parent_contact,
              enrolledAt: s.enrolled_at,
              status: s.status,
              studentCode: s.student_code,
            }}
          />
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              {t("recentAttendance", { count: recentLogs.length })}
            </p>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">{t("noLogs")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {recentLogs.map((l, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        l.kind === "check_in"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {l.kind === "check_in" ? t("checkIn") : t("checkOut")}
                    </span>
                    <span className="text-[var(--color-muted)]">{l.ts}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8">
        <NotesSection
          studentId={s.id}
          notes={notes}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      </div>
    </div>
  );
}
