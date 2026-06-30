// 온라인 복습 시험 점수 계산 — 서버/클라이언트 공용 순수 로직
import { grade, GRADE_META, type GradeKey, type GradeCuts, DEFAULT_CUTS } from "@/lib/assessments/scoring";

export { grade, GRADE_META, DEFAULT_CUTS };
export type { GradeKey, GradeCuts };

export type Section = "listening" | "reading" | "grammar_vocab" | "writing" | "speaking";

export const SECTIONS: { key: Section; label: string; weightKey: WeightKey; mcq: boolean }[] = [
  { key: "listening", label: "듣기", weightKey: "w_listening", mcq: true },
  { key: "reading", label: "읽기", weightKey: "w_reading", mcq: true },
  { key: "grammar_vocab", label: "어휘·문법", weightKey: "w_grammar", mcq: true },
  { key: "writing", label: "쓰기", weightKey: "w_writing", mcq: false },
  { key: "speaking", label: "말하기", weightKey: "w_speaking", mcq: false },
];

export type WeightKey = "w_listening" | "w_reading" | "w_grammar" | "w_writing" | "w_speaking";
export type ExamWeights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: ExamWeights = {
  w_listening: 20,
  w_reading: 20,
  w_grammar: 30,
  w_writing: 15,
  w_speaking: 15,
};

export function weightsTotal(w: ExamWeights): number {
  return SECTIONS.reduce((a, s) => a + (w[s.weightKey] ?? 0), 0);
}

export type SectionScores = Record<Section, number | null>;

export function attemptTotal(s: SectionScores): number {
  return SECTIONS.reduce((a, sec) => a + (s[sec.key] ?? 0), 0);
}

// 응시 결과를 total_score 내림차순으로 정렬해 반 내 순위(동점 공동) 맵 반환.
export function rankByTotal<T extends { id: string; total: number | null }>(
  attempts: T[]
): Map<string, number> {
  const ranked = [...attempts].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const map = new Map<string, number>();
  ranked.forEach((r, i) => {
    if (i > 0 && ranked[i - 1].total === r.total) {
      map.set(r.id, map.get(ranked[i - 1].id)!);
    } else {
      map.set(r.id, i + 1);
    }
  });
  return map;
}

export const SECTION_LABEL: Record<Section, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s.label])
) as Record<Section, string>;

export const SECTION_ORDER: Section[] = SECTIONS.map((s) => s.key);
