import { Link } from "@/i18n/navigation";
import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";
import { average, type AreaScores } from "@/lib/assessments/scoring";

type RoundRow = {
  id: string;
  title: string;
  class_name: string;
  date: string;
  roster: number;
};

type ScoreRow = {
  round_id: string;
  listening_score: number | null;
  speaking_score: number | null;
  reading_score: number | null;
  writing_score: number | null;
  pronunciation_score: number | null;
};

export default async function AssessmentsPage() {
  const orgId = await getCurrentOrgId();

  const rounds = (await sql`
    select r.id::text, r.title,
           c.name as class_name,
           to_char(r.assessment_date, 'YYYY-MM-DD') as date,
           (select count(*)::int from students s
             where s.class_id = r.class_id and s.organization_id = r.organization_id) as roster
    from assessment_rounds r
    join classes c on c.id = r.class_id
    where r.organization_id = ${orgId}
    order by r.assessment_date desc, r.created_at desc
    limit 100
  `) as RoundRow[];

  const scores =
    rounds.length > 0
      ? ((await sql`
          select round_id::text, listening_score, speaking_score, reading_score, writing_score, pronunciation_score
          from assessment_scores
          where organization_id = ${orgId}
            and round_id = any(${rounds.map((r) => r.id)}::uuid[])
        `) as ScoreRow[])
      : [];

  const byRound = new Map<string, AreaScores[]>();
  for (const s of scores) {
    const arr = byRound.get(s.round_id) ?? [];
    arr.push({
      listening: s.listening_score,
      speaking: s.speaking_score,
      reading: s.reading_score,
      writing: s.writing_score,
      pronunciation: s.pronunciation_score,
    });
    byRound.set(s.round_id, arr);
  }

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">주말 평가</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            매주 듣기·말하기·읽기·쓰기 + 발음 점수를 입력하면 평균·순위·등급·보고서가 자동 정리됩니다.
          </p>
        </div>
        <Link
          href="/admin/assessments/new"
          className="brand-gradient shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
        >
          + 새 평가 회차
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            아직 평가 회차가 없습니다. “새 평가 회차”로 시작하세요.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-soft)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold">회차</th>
                <th className="px-4 py-3 text-left font-bold">반</th>
                <th className="px-4 py-3 text-left font-bold">평가일</th>
                <th className="px-4 py-3 text-left font-bold">입력</th>
                <th className="px-4 py-3 text-left font-bold">반 평균</th>
                <th className="px-4 py-3 text-left font-bold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {rounds.map((r) => {
                const rows = byRound.get(r.id) ?? [];
                const avgs = rows.map(average).filter((v): v is number => v !== null);
                const filled = avgs.length;
                const classAvg = filled
                  ? Math.round((avgs.reduce((a, b) => a + b, 0) / filled) * 10) / 10
                  : null;
                const done = r.roster > 0 && filled >= r.roster;
                return (
                  <tr key={r.id} className="hover:bg-[var(--color-soft)]/40">
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/admin/assessments/${r.id}`}
                        className="hover:text-[var(--color-primary)]"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.class_name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{r.date}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {filled}/{r.roster}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums">{classAvg ?? "—"}</td>
                    <td className="px-4 py-3">
                      {done ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          완료
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          입력중
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
