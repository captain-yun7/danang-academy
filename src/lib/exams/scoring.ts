// 주간 4대영역 시험 — 서버/클라이언트 공용 순수 로직 (DB 의존 없음)
import { grade, GRADE_META, type GradeKey, type GradeCuts, DEFAULT_CUTS } from "@/lib/assessments/scoring";

export { grade, GRADE_META, DEFAULT_CUTS };
export type { GradeKey, GradeCuts };

export type Skill = "listening" | "reading" | "writing" | "speaking";

export const SKILLS: { key: Skill; label: string }[] = [
  { key: "listening", label: "듣기" },
  { key: "reading", label: "읽기" },
  { key: "writing", label: "쓰기" },
  { key: "speaking", label: "말하기" },
];
export const SKILL_ORDER: Skill[] = SKILLS.map((s) => s.key);
export const SKILL_LABEL: Record<Skill, string> = Object.fromEntries(
  SKILLS.map((s) => [s.key, s.label])
) as Record<Skill, string>;

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "fill_blank"
  | "arrange_sentence"
  | "translation"
  | "short_writing"
  | "speaking_recording";

export const QUESTION_TYPES: {
  key: QuestionType;
  label: string;
  skills: Skill[];
  grading: "auto" | "ai" | "speaking";
}[] = [
  { key: "multiple_choice", label: "객관식", skills: ["listening", "reading"], grading: "auto" },
  { key: "true_false", label: "O/X", skills: ["listening"], grading: "auto" },
  { key: "matching", label: "문장 연결", skills: ["reading"], grading: "auto" },
  { key: "fill_blank", label: "빈칸 채우기", skills: ["writing"], grading: "auto" },
  { key: "arrange_sentence", label: "문장 배열", skills: ["writing"], grading: "auto" },
  { key: "translation", label: "번역(베→한)", skills: ["writing"], grading: "ai" },
  { key: "short_writing", label: "짧은 글쓰기", skills: ["writing"], grading: "ai" },
  { key: "speaking_recording", label: "녹음", skills: ["speaking"], grading: "speaking" },
];

export const TYPES_FOR_SKILL: Record<Skill, QuestionType[]> = {
  listening: ["multiple_choice", "true_false"],
  reading: ["multiple_choice", "matching"],
  writing: ["fill_blank", "arrange_sentence", "translation", "short_writing"],
  speaking: ["speaking_recording"],
};

export function typeMeta(t: QuestionType) {
  return QUESTION_TYPES.find((q) => q.key === t)!;
}
export function isAutoType(t: QuestionType): boolean {
  return typeMeta(t).grading === "auto";
}

export type SkillScores = Record<Skill, number | null>;

// 총점 = 4영역 합(각 /100 → /400)
export function testTotal(s: SkillScores): number {
  return SKILL_ORDER.reduce((a, k) => a + (s[k] ?? 0), 0);
}
// 평균 = 총점 / 4 (/100)
export function testAverage(s: SkillScores): number | null {
  const vals = SKILL_ORDER.map((k) => s[k]).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return Math.round((testTotal(s) / 4) * 100) / 100;
}

// 총점 내림차순 반 내 순위(동점 공동)
export function rankByTotal<T extends { id: string; total: number | null }>(
  rows: T[]
): Map<string, number> {
  const ranked = [...rows].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const map = new Map<string, number>();
  ranked.forEach((r, i) => {
    if (i > 0 && ranked[i - 1].total === r.total) map.set(r.id, map.get(ranked[i - 1].id)!);
    else map.set(r.id, i + 1);
  });
  return map;
}

// 영역 원점수를 100으로 정규화
export function normalizeSkill(awarded: number, possible: number): number {
  return possible > 0 ? Math.round((awarded / possible) * 100) : 0;
}

// 문자열 정답 비교용 정규화 (빈칸/배열)
export function normText(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
