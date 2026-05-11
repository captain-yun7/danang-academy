import { sql } from "@/lib/db/client";
import { AudioCell } from "./audio-cell";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  processing: "채점 중",
  completed: "완료",
  failed: "실패",
};
const TYPE_LABEL: Record<string, string> = {
  free_pron: "발음",
  placement: "레벨",
};

type UnifiedRow = {
  id: string;
  type: "free_pron" | "placement";
  visitor_name: string;
  status: string;
  score: number | null;
  recommended_level: string | null;
  created_at: string;
  details: string | null;
};

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.type === "free_pron" || sp.type === "placement" ? sp.type : null;

  const fpts = (await sql`
    select id::text, visitor_name, status::text, score,
           recommended_class_level::text as level,
           target_sentence,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from free_pronunciation_tests
    order by created_at desc
    limit 200
  `) as Array<{
    id: string;
    visitor_name: string;
    status: string;
    score: number | null;
    level: string | null;
    target_sentence: string;
    created_at: string;
  }>;

  const pts = (await sql`
    select id::text, visitor_name, status::text, mcq_score,
           recommended_level::text as level,
           to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as created_at
    from placement_tests
    order by created_at desc
    limit 200
  `) as Array<{
    id: string;
    visitor_name: string;
    status: string;
    mcq_score: number;
    level: string | null;
    created_at: string;
  }>;

  const all: UnifiedRow[] = [
    ...fpts.map((r) => ({
      id: r.id,
      type: "free_pron" as const,
      visitor_name: r.visitor_name,
      status: r.status,
      score: r.score,
      recommended_level: r.level,
      created_at: r.created_at,
      details: r.target_sentence,
    })),
    ...pts.map((r) => ({
      id: r.id,
      type: "placement" as const,
      visitor_name: r.visitor_name,
      status: r.status,
      score: r.mcq_score,
      recommended_level: r.level,
      created_at: r.created_at,
      details: `MCQ ${r.mcq_score}/7`,
    })),
  ]
    .filter((r) => !filter || r.type === filter)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const tabs: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "전체", count: fpts.length + pts.length },
    { key: "free_pron", label: "발음", count: fpts.length },
    { key: "placement", label: "레벨", count: pts.length },
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Tests
      </p>
      <h1 className="mt-1 text-2xl font-bold">테스트 이력</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        무료 발음 / 레벨 테스트 응시자와 결과를 한곳에서 봐요.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const href = t.key ? `?type=${t.key}` : "?";
          const active = (filter ?? null) === t.key;
          return (
            <a
              key={t.key ?? "all"}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                active
                  ? "brand-gradient text-white"
                  : "border border-[var(--color-line)] hover:border-[var(--color-ink)]"
              }`}
            >
              {t.label} <span className="opacity-70">{t.count}</span>
            </a>
          );
        })}
      </div>

      {all.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">아직 응시 이력이 없어요.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">유형</th>
                <th className="px-4 py-3 text-left font-bold">이름</th>
                <th className="px-4 py-3 text-left font-bold">상태</th>
                <th className="px-4 py-3 text-left font-bold">점수</th>
                <th className="px-4 py-3 text-left font-bold">추천</th>
                <th className="px-4 py-3 text-left font-bold">상세</th>
                <th className="px-4 py-3 text-left font-bold">녹음</th>
                <th className="px-4 py-3 text-left font-bold">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {all.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-[var(--color-soft)]/40">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-xs font-bold">
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.visitor_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{r.score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.recommended_level ? (
                      <span className="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs font-semibold">
                        {LEVEL_LABEL[r.recommended_level]}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-[var(--color-muted)]">
                    {r.details}
                  </td>
                  <td className="px-4 py-3">
                    <AudioCell testId={r.id} type={r.type} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
