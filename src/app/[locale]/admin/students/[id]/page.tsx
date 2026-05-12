import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { StudentForm } from "../student-form";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};

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
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           s.qr_token,
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
    enrolled_at: string | null;
    qr_token: string;
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

  // 사이트 호스트 추출 (QR URL용)
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const qrUrl = `${proto}://${host}/qr/${s.qr_token}`;
  const qrPng = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 220,
    color: { dark: "#0b1020", light: "#ffffff" },
  });

  return (
    <div>
      <Link
        href="/admin/students"
        className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← 학생 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{s.name}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {s.class_name ? `${s.class_name} · ` : ""}
        {s.korean_level ? LEVEL_LABEL[s.korean_level] : "레벨 미정"}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold">기본 정보 수정</h2>
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
            }}
          />
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              QR 출석 토큰
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPng} alt="QR" className="mx-auto mt-3 h-44 w-44" />
            <p className="mt-3 break-all text-[10px] text-[var(--color-muted)]">
              {qrUrl}
            </p>
            <a
              href={qrPng}
              download={`qr-${s.name}.png`}
              className="mt-3 inline-block text-xs font-bold text-[var(--color-primary-deep)]"
            >
              다운로드
            </a>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              최근 출석 ({recentLogs.length})
            </p>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">아직 기록 없음</p>
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
                      {l.kind === "check_in" ? "입실" : "퇴실"}
                    </span>
                    <span className="text-[var(--color-muted)]">{l.ts}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
