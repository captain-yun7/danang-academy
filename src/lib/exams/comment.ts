import { generateJsonWithRetry, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { SECTIONS, grade, GRADE_META, type GradeCuts, type Section } from "./scoring";

const SCHEMA = {
  type: "object",
  properties: { comment: { type: "string" } },
  required: ["comment"],
} as const;

export async function generateExamComment(input: {
  studentName: string;
  sectionScores: Record<Section, number | null>;
  weights: Record<Section, number>;
  total: number;
  cuts: GradeCuts;
}): Promise<string> {
  const { studentName, sectionScores, weights, total, cuts } = input;
  const g = grade(total, cuts);
  const gLabel = g ? GRADE_META[g].label : "—";
  if (!isAIConfigured()) return templateComment(studentName, g);

  const lines = SECTIONS.map((s) => `${s.label}: ${sectionScores[s.key] ?? 0}/${weights[s.key]}`).join(", ");
  const prompt = `당신은 한국어 학원 교사입니다. 베트남 다낭 학원에서 학부모에게 보낼 주말 복습 시험 코멘트를 작성하세요.
학생: ${studentName}
영역별 점수: ${lines}
총점: ${total}/100, 등급: ${gLabel}

요구사항: 한국어 2~3문장, 따뜻하고 격려하는 어조. 강점 영역과 보완 영역을 구체적으로 언급하고, 가정 학습 제안 1개 포함. 학생 이름으로 시작.`;
  try {
    const raw = await generateJsonWithRetry(prompt, SCHEMA);
    const parsed = JSON.parse(raw) as { comment?: string };
    const t = parsed.comment?.trim();
    if (t) return t;
  } catch {
    /* 폴백 */
  }
  return templateComment(studentName, g);
}

function templateComment(name: string, g: ReturnType<typeof grade>): string {
  switch (g) {
    case "excellent":
      return `${name} 학생은 이번 복습 시험에서 전 영역 우수한 성취를 보였습니다. 꾸준한 학습을 응원합니다.`;
    case "good":
      return `${name} 학생은 전반적으로 안정적입니다. 약점 영역을 조금 보완하면 더 좋은 결과가 기대됩니다.`;
    case "normal":
      return `${name} 학생은 기본기를 다져가고 있습니다. 가정에서 매일 짧게 복습을 도와주세요.`;
    case "support":
      return `${name} 학생은 추가 학습이 필요합니다. 가정에서 꾸준한 복습을 도와주시면 점차 향상될 것입니다.`;
    default:
      return `${name} 학생의 이번 복습 시험 결과입니다. 다음 주에도 응원합니다.`;
  }
}
