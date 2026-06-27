import { generateJsonWithRetry, isAIConfigured } from "@/lib/ai/evaluate-pronunciation";
import {
  AREA_LABELS,
  GRADE_META,
  average,
  grade,
  type AreaScores,
  type GradeCuts,
} from "./scoring";

const SCHEMA = {
  type: "object",
  properties: { comment: { type: "string" } },
  required: ["comment"],
} as const;

// 점수·등급 기반 학부모 코멘트 초안 생성. AI 미설정/실패 시 템플릿 폴백.
export async function generateParentComment(input: {
  studentName: string;
  scores: AreaScores;
  cuts: GradeCuts;
}): Promise<string> {
  const avg = average(input.scores);
  const g = grade(avg, input.cuts);
  const gLabel = g ? GRADE_META[g].label : "—";

  if (!isAIConfigured()) return templateComment(input.studentName, g);

  const lines = AREA_LABELS.map((a) => `${a.label}: ${input.scores[a.key] ?? "미응시"}`).join(", ");
  const prompt = `당신은 한국어 학원 교사입니다. 베트남 다낭의 한국어 학원에서 학부모에게 보낼 주말 평가 코멘트를 작성하세요.
학생 이름: ${input.studentName}
영역별 점수(100점 만점): ${lines}
평균: ${avg ?? "—"}, 등급: ${gLabel}

요구사항:
- 한국어로 2~3문장, 따뜻하고 격려하는 어조
- 강점 영역과 보완 영역을 구체적으로 언급
- 가정에서 도울 수 있는 짧은 제안 1개 포함
- 학생 이름으로 시작`;

  try {
    const raw = await generateJsonWithRetry(prompt, SCHEMA);
    const parsed = JSON.parse(raw) as { comment?: string };
    const text = parsed.comment?.trim();
    if (text) return text;
  } catch {
    // 폴백으로 진행
  }
  return templateComment(input.studentName, g);
}

function templateComment(name: string, g: ReturnType<typeof grade>): string {
  switch (g) {
    case "excellent":
      return `${name} 학생은 이번 주 전 영역에서 우수한 성취를 보였습니다. 꾸준한 학습 습관을 이어가면 더욱 좋은 결과가 기대됩니다.`;
    case "good":
      return `${name} 학생은 전반적으로 안정적인 실력을 보이고 있습니다. 약점 영역을 조금만 보완하면 우수 등급에 도달할 수 있습니다.`;
    case "normal":
      return `${name} 학생은 기본기를 다져가고 있습니다. 매일 짧게라도 듣기와 읽기 연습을 도와주시면 향상에 큰 도움이 됩니다.`;
    case "support":
      return `${name} 학생은 추가 학습이 필요합니다. 가정에서도 매일 꾸준한 복습을 도와주시면 점차 나아질 것입니다.`;
    default:
      return `${name} 학생의 이번 주 평가 결과입니다. 다음 주에도 꾸준한 학습을 응원합니다.`;
  }
}
