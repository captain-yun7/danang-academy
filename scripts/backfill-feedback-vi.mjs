/**
 * 발음 평가 결과 피드백(strengths/improvements) 백필 — 한국어 → 베트남어
 *
 * - 기존 데이터의 점수(score), recommended_class_level 은 유지
 * - strengths/improvements 만 Gemini 로 베트남어 재생성해 in-place UPDATE
 * - 멱등: strengths/improvements 에 한글이 남은 row 만 대상
 *
 * 사용: node --env-file=.env.local scripts/backfill-feedback-vi.mjs
 */

import { neon } from "@neondatabase/serverless";
import { GoogleGenerativeAI } from "@google/generative-ai";

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

const sql = neon(dbUrl);
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCHEMA = {
  type: "object",
  properties: {
    strengths: { type: "string" },
    improvements: { type: "string" },
  },
  required: ["strengths", "improvements"],
};

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

async function generateViFeedback({ target, transcript, score, level }) {
  const prompt = [
    "Bạn là chuyên gia đánh giá phát âm tại trung tâm tiếng Hàn ở Việt Nam.",
    "Học sinh đã được chấm điểm rồi — bây giờ bạn chỉ viết lại nhận xét bằng tiếng Việt.",
    "",
    `Câu mục tiêu (tiếng Hàn): "${target}"`,
    `STT (học sinh đọc thực tế): "${transcript}"`,
    `Điểm đã chấm: ${score}/100`,
    level ? `Trình độ tự đánh giá: ${level}` : "",
    "",
    "Quy tắc đầu ra:",
    "- strengths: một câu tiếng Việt, khen điểm tốt cụ thể của phát âm.",
    "- improvements: một câu tiếng Việt, gợi ý cải thiện cụ thể.",
    "- KHÔNG dùng tiếng Hàn trong câu giải thích (chỉ trích dẫn âm/từ tiếng Hàn cụ thể trong dấu nháy đơn — ví dụ 'ㄷ', 'ㅌ', 'ㅏ', 'ㅐ', '다낭').",
    "- KHÔNG dùng tiếng Anh hoặc dịch nghĩa trong ngoặc (không viết 'Market', '(meaning ...)' v.v.).",
    "- Thân thiện, dễ hiểu cho người Việt học tiếng Hàn.",
  ]
    .filter(Boolean)
    .join("\n");

  let lastErr = null;
  for (const modelName of FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const model = gemini.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 0.4,
          },
        });
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
      } catch (err) {
        lastErr = err;
        const status = err.status;
        if (status !== 503 && status !== 429 && status !== 500) throw err;
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

const rows = await sql`
  select id::text, target_sentence, transcript, score,
         korean_level::text as level, strengths, improvements
  from free_pronunciation_tests
  where status = 'completed'
    and (strengths ~ '[가-힣]' or improvements ~ '[가-힣]')
  order by created_at asc
`;

console.log(`백필 대상: ${rows.length}건\n`);

let done = 0;
let skipped = 0;
let failed = 0;

for (const r of rows) {
  const tag = `${r.id.slice(0, 8)} (score ${r.score}/100)`;
  try {
    if (!r.transcript || !r.target_sentence) {
      skipped += 1;
      console.log(`  ⊘ ${tag} — transcript/target 없음, 스킵`);
      continue;
    }
    const fb = await generateViFeedback({
      target: r.target_sentence,
      transcript: r.transcript,
      score: r.score,
      level: r.level,
    });
    await sql`
      update free_pronunciation_tests
      set strengths = ${fb.strengths},
          improvements = ${fb.improvements}
      where id = ${r.id}
    `;
    done += 1;
    console.log(`  ✓ ${tag}`);
    console.log(`      ${fb.strengths}`);
    console.log(`      ${fb.improvements}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${tag} — ${e.message}`);
  }
}

console.log(`\n완료: 성공 ${done} · 스킵 ${skipped} · 실패 ${failed}`);
