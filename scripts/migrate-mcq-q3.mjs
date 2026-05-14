/**
 * 일회성 마이그레이션 — MCQ 3번 ('시장의 뜻은?') 문제를 답이 보기에 노출되지 않는
 * '다음 중 동물을 가리키는 단어는?' 문제로 in-place 교체.
 *
 * 사용:  node --env-file=.env.local scripts/migrate-mcq-q3.mjs
 *
 * 멱등 — 이미 새 문제로 갱신돼있으면 변경사항 0건.
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);

const OLD_KO = "'시장'의 뜻은 무엇인가요?";
const NEW = {
  question_ko: "다음 중 동물을 가리키는 단어는?",
  question_vi: "Từ nào dưới đây chỉ một loài động vật?",
  choices: [
    { ko: "책상", vi: "Cái bàn" },
    { ko: "고양이", vi: "Con mèo" },
    { ko: "사과", vi: "Quả táo" },
    { ko: "학교", vi: "Trường học" },
  ],
  answer_index: 1,
};

const result = await sql`
  update mcq_questions
  set question_ko = ${NEW.question_ko},
      question_vi = ${NEW.question_vi},
      choices = ${JSON.stringify(NEW.choices)}::jsonb,
      answer_index = ${NEW.answer_index}
  where version = 'v1' and question_ko = ${OLD_KO}
  returning id
`;

if (result.length === 0) {
  console.log("→ 이미 갱신됐거나 대상 row 없음 (변경 0)");
} else {
  console.log(`→ ${result.length}건 갱신: 시장 문제 → 동물 분류 문제`);
}
