import OpenAI from "openai";

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export function isTtsConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// 한국어 모범음성 생성 (기본 0.75배속). mp3 ArrayBuffer 반환.
// 과제당 1회 생성해 R2에 캐시 — 실시간 호출 금지(비용 최소).
export async function synthesizeKorean(
  text: string,
  speed = 0.75
): Promise<ArrayBuffer> {
  const res = await openai().audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    speed,
    response_format: "mp3",
  });
  return res.arrayBuffer();
}
