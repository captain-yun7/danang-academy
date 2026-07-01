import { generateJsonWithRetry, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import { SKILLS, grade, GRADE_META, type GradeCuts, type Skill } from "./scoring";

const SCHEMA = {
  type: "object",
  properties: { comment: { type: "string" } },
  required: ["comment"],
} as const;

export async function generateWeeklyComment(input: {
  studentName: string;
  skillScores: Record<Skill, number | null>;
  total: number;
  average: number;
  cuts: GradeCuts;
}): Promise<string> {
  const { studentName, skillScores, total, average, cuts } = input;
  const g = grade(average, cuts);
  const gLabel = g ? GRADE_META[g].label : "—";
  if (!isAIConfigured()) return template(studentName, g);

  const lines = SKILLS.map((s) => `${s.label}: ${skillScores[s.key] ?? 0}/100`).join(", ");
  const prompt = `당신은 한국어 학원 교사입니다. 베트남 다낭 학원에서 학부모에게 보낼 주간 시험 코멘트를 작성하세요.
학생: ${studentName}
영역별: ${lines}
총점: ${total}/400, 평균: ${average}/100, 등급: ${gLabel}
요구사항: 한국어 2~3문장, 따뜻하고 격려하는 어조. 강점·보완 영역 구체적으로, 가정 학습 제안 1개, 학생 이름으로 시작.`;
  try {
    const raw = await generateJsonWithRetry(prompt, SCHEMA);
    const p = JSON.parse(raw) as { comment?: string };
    const t = p.comment?.trim();
    if (t) return t;
  } catch {
    /* 폴백 */
  }
  return template(studentName, g);
}

function template(name: string, g: ReturnType<typeof grade>): string {
  switch (g) {
    case "excellent":
      return `${name} 학생은 이번 주간 시험에서 전 영역 우수한 성취를 보였습니다. 꾸준한 학습을 응원합니다.`;
    case "good":
      return `${name} 학생은 전반적으로 안정적입니다. 약점 영역을 조금 보완하면 더 좋은 결과가 기대됩니다.`;
    case "normal":
      return `${name} 학생은 기본기를 다져가고 있습니다. 가정에서 매일 짧게 복습을 도와주세요.`;
    case "support":
      return `${name} 학생은 추가 학습이 필요합니다. 가정에서 꾸준한 복습을 도와주시면 점차 향상될 것입니다.`;
    default:
      return `${name} 학생의 이번 주간 시험 결과입니다. 다음 주에도 응원합니다.`;
  }
}
