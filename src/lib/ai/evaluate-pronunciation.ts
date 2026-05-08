import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type EvaluationResult = {
  transcript: string;
  score: number;
  strengths: string;
  improvements: string;
  recommendedLevel: "beginner" | "elementary" | "intermediate" | "advanced";
};

export class AINotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`AI 키 누락: ${missing.join(", ")}`);
    this.name = "AINotConfiguredError";
  }
}

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new AINotConfiguredError(["OPENAI_API_KEY"]);
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

let _gemini: GoogleGenerativeAI | null = null;
function gemini() {
  if (!_gemini) {
    if (!process.env.GEMINI_API_KEY) throw new AINotConfiguredError(["GEMINI_API_KEY"]);
    _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _gemini;
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY && !!process.env.GEMINI_API_KEY;
}

export async function transcribeKorean(
  audioBytes: ArrayBuffer,
  contentType: string,
  filename = "audio"
): Promise<string> {
  const ext = contentType.includes("webm")
    ? "webm"
    : contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("ogg")
        ? "ogg"
        : "wav";
  const file = new File([audioBytes], `${filename}.${ext}`, { type: contentType });
  const res = await openai().audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "ko",
  });
  return res.text.trim();
}

const SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "string" },
    improvements: { type: "string" },
    recommendedLevel: {
      type: "string",
      enum: ["beginner", "elementary", "intermediate", "advanced"],
    },
  },
  required: ["score", "strengths", "improvements", "recommendedLevel"],
} as const;

export async function evaluateWithGemini({
  target,
  transcript,
  declaredLevel,
}: {
  target: string;
  transcript: string;
  declaredLevel?: string;
}): Promise<Omit<EvaluationResult, "transcript">> {
  const model = gemini().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // @ts-expect-error responseSchema is supported but typings lag
      responseSchema: SCHEMA,
      temperature: 0.4,
    },
  });

  const prompt = [
    "당신은 베트남에서 한국어를 가르치는 학원의 발음 평가 전문가입니다.",
    "학생의 발음 녹음을 STT로 받아쓴 결과와 목표 문장을 비교해 평가합니다.",
    "",
    `목표 문장: "${target}"`,
    `STT 결과(학생이 실제로 읽은 것으로 추정): "${transcript}"`,
    declaredLevel ? `학생이 신고한 자가 평가 레벨: ${declaredLevel}` : "",
    "",
    "평가 기준:",
    "- 정확도(목표와 일치): 받침/모음/자음 누락·왜곡 여부",
    "- 자연스러움: 띄어쓰기/억양/속도",
    "- 베트남어권 학습자가 자주 틀리는 부분(받침 ㄱ/ㄴ/ㅇ, 모음 ㅓ/ㅗ, 격음/경음)",
    "",
    "출력 규칙:",
    "- score: 0~100 정수. 80 이상은 발음이 매우 명확할 때만.",
    "- strengths/improvements: 한국어로 한 문장씩, 학생이 알아듣기 쉽게 친절하게.",
    "- recommendedLevel: beginner|elementary|intermediate|advanced 중 하나.",
    '- STT 결과가 목표와 거의 동일하면 점수 높게, 많이 다르면 낮게.',
    '- STT 결과가 비어있거나 의미 없는 문자열이면 score 30 이하 + recommendedLevel "beginner".',
  ]
    .filter(Boolean)
    .join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as {
    score: number;
    strengths: string;
    improvements: string;
    recommendedLevel: EvaluationResult["recommendedLevel"];
  };
  return parsed;
}

export async function evaluatePronunciation({
  audioBytes,
  contentType,
  target,
  declaredLevel,
}: {
  audioBytes: ArrayBuffer;
  contentType: string;
  target: string;
  declaredLevel?: string;
}): Promise<EvaluationResult> {
  const transcript = await transcribeKorean(audioBytes, contentType);
  const evalResult = await evaluateWithGemini({ target, transcript, declaredLevel });
  return { transcript, ...evalResult };
}
