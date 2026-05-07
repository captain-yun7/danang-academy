import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};
const LANG_LABEL: Record<string, string> = {
  vi: "🇻🇳 vi",
  en: "🇺🇸 en",
  other: "기타",
};

type Row = {
  id: string;
  name: string;
  phone: string | null;
  native_language: string;
  korean_level: string | null;
  class_name: string | null;
  enrolled_at: string | null;
  qr_token: string;
  created_at: string;
};

export default async function AdminStudentsPage() {
  const students = (await sql`
    select s.id::text, s.name, s.phone,
           s.native_language::text,
           s.korean_level::text,
           c.name as class_name,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           s.qr_token,
           to_char(s.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as created_at
    from students s
    left join classes c on c.id = s.class_id
    order by s.created_at desc
  `) as Row[];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Students
          </p>
          <h1 className="mt-1 text-2xl font-bold">학생 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            총 {students.length}명 · 클릭하면 QR 코드와 출석 이력을 볼 수 있어요
          </p>
        </div>
        <Link
          href="/admin/students/new"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          + 새 학생 등록
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            아직 등록된 학생이 없어요.
          </p>
          <Link
            href="/admin/students/new"
            className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-deep)]"
          >
            첫 학생 등록하기 →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">이름</th>
                <th className="px-4 py-3 text-left font-bold">연락처</th>
                <th className="px-4 py-3 text-left font-bold">레벨</th>
                <th className="px-4 py-3 text-left font-bold">반</th>
                <th className="px-4 py-3 text-left font-bold">모국어</th>
                <th className="px-4 py-3 text-left font-bold">등록일</th>
                <th className="px-4 py-3 text-right font-bold">QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="hover:text-[var(--color-primary-deep)]"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.korean_level ? (
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-xs font-semibold">
                        {LEVEL_LABEL[s.korean_level]}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{s.class_name ?? "미배정"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {LANG_LABEL[s.native_language] ?? s.native_language}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {s.enrolled_at ?? s.created_at}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="text-xs font-semibold text-[var(--color-primary-deep)] hover:underline"
                    >
                      보기 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
