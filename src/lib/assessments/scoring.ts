// 주말 평가 점수 계산 — 서버/클라이언트 공용 순수 로직 (DB 의존 없음)

export type AreaKey = "listening" | "speaking" | "reading" | "writing" | "pronunciation";

export type AreaScores = Record<AreaKey, number | null>;

export const AREA_LABELS: { key: AreaKey; label: string; short: string }[] = [
  { key: "listening", label: "듣기", short: "듣" },
  { key: "speaking", label: "말하기", short: "말" },
  { key: "reading", label: "읽기", short: "읽" },
  { key: "writing", label: "쓰기", short: "쓰" },
  { key: "pronunciation", label: "발음", short: "발" },
];

export const AREA_KEYS: AreaKey[] = AREA_LABELS.map((a) => a.key);

export type GradeCuts = { excellent: number; good: number; normal: number };
export const DEFAULT_CUTS: GradeCuts = { excellent: 90, good: 75, normal: 60 };

export type GradeKey = "excellent" | "good" | "normal" | "support";

export const GRADE_META: Record<GradeKey, { label: string; tone: string; dot: string }> = {
  excellent: { label: "우수", tone: "bg-emerald-100 text-emerald-700", dot: "🟢" },
  good: { label: "양호", tone: "bg-sky-100 text-sky-700", dot: "🔵" },
  normal: { label: "보통", tone: "bg-amber-100 text-amber-700", dot: "🟡" },
  support: { label: "보충 필요", tone: "bg-red-100 text-red-700", dot: "🔴" },
};

export function average(s: AreaScores): number | null {
  const vals = AREA_KEYS.map((k) => s[k]).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function total(s: AreaScores): number {
  return AREA_KEYS.reduce((a, k) => a + (s[k] ?? 0), 0);
}

export function grade(avg: number | null, cuts: GradeCuts = DEFAULT_CUTS): GradeKey | null {
  if (avg === null) return null;
  if (avg >= cuts.excellent) return "excellent";
  if (avg >= cuts.good) return "good";
  if (avg >= cuts.normal) return "normal";
  return "support";
}

// 평균 내림차순 + 동점 공동순위. id→순위 맵 반환.
export function rankByAverage<T extends { id: string; scores: AreaScores }>(
  students: T[]
): Map<string, number> {
  const ranked = [...students]
    .map((s) => ({ id: s.id, avg: average(s.scores) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const map = new Map<string, number>();
  ranked.forEach((r, i) => {
    if (i > 0 && ranked[i - 1].avg === r.avg) {
      map.set(r.id, map.get(ranked[i - 1].id)!);
    } else {
      map.set(r.id, i + 1);
    }
  });
  return map;
}
