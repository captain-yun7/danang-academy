import { z } from "zod";
import { generateJsonWithRetry } from "@/lib/ai/evaluate-pronunciation";

const generatedStepsSchema = z.object({
  words: z.array(z.string().trim().min(1)).min(1),
  phrases: z.array(z.string().trim().min(1)).min(1),
  sentences: z.array(z.string().trim().min(1)).min(1),
  passage: z.string().trim().min(1),
});

export type GeneratedSteps = z.infer<typeof generatedStepsSchema>;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    words: { type: "array", items: { type: "string" } },
    phrases: { type: "array", items: { type: "string" } },
    sentences: { type: "array", items: { type: "string" } },
    passage: { type: "string" },
  },
  required: ["words", "phrases", "sentences", "passage"],
} as const;

/**
 * 수업 내용(어휘/문법/대화문)에서 발음 연습 단계 자료를 생성한다.
 * word → phrase → sentence → passage 4단계용. 과제 생성 시 1회 호출 (배치 — 비용 최소).
 */
export async function generateStepItems(
  sourceText: string,
  locale: "ko" = "ko"
): Promise<GeneratedSteps> {
  void locale; // 현재 한국어 자료만 지원

  const prompt = [
    "당신은 베트남에서 한국어를 가르치는 학원의 교재 개발 전문가입니다.",
    "아래 수업 자료(어휘/문법/대화문)를 바탕으로 발음 연습용 단계별 자료를 만드세요.",
    "",
    "수업 자료:",
    "---",
    sourceText,
    "---",
    "",
    "생성 규칙:",
    "- words: 핵심 단어 6~10개. 수업 자료에 나온 어휘 위주.",
    "- phrases: 짧은 구 4~6개 (2~4 어절). 자료의 어휘·문법 조합.",
    "- sentences: 완결된 문장 4~6개. 자료의 문법 패턴 활용.",
    "- passage: 소리 내어 읽으면 20~30초 분량의 발화문 1개 (5~8문장, 자연스러운 흐름).",
    "- 반드시 수업 자료에 등장하거나 그 수준에서 자연스러운 어휘·문법만 사용.",
    "- 모든 출력은 한국어. 번역·로마자 표기·설명 금지.",
  ].join("\n");

  const text = await generateJsonWithRetry(prompt, RESPONSE_SCHEMA);
  return generatedStepsSchema.parse(JSON.parse(text));
}
