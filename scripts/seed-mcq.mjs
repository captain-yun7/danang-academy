// 레벨테스트 객관식 5문항 AI 초안 시드 (강사 검수 전 placeholder)
// 사용: node --env-file=.env.local scripts/seed-mcq.mjs

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const sql = neon(url);

const QUESTIONS = [
  {
    level_target: "beginner",
    weight: 1,
    question_ko: "다음 중 받침이 'ㄱ'인 글자는?",
    question_vi: "Chữ nào dưới đây có patchim 'ㄱ'?",
    choices: [
      { ko: "밥", vi: "밥 (cơm)" },
      { ko: "책", vi: "책 (sách)" },
      { ko: "물", vi: "물 (nước)" },
      { ko: "산", vi: "산 (núi)" },
    ],
    answer_index: 1,
  },
  {
    level_target: "elementary",
    weight: 1,
    question_ko: "저___ 학생입니다. 빈칸에 알맞은 것은?",
    question_vi: "Tôi là học sinh. Điền vào chỗ trống cho đúng:",
    choices: [
      { ko: "이", vi: "이" },
      { ko: "가", vi: "가" },
      { ko: "는", vi: "는" },
      { ko: "을", vi: "을" },
    ],
    answer_index: 2,
  },
  {
    level_target: "elementary",
    weight: 1,
    question_ko: "'시장'의 뜻은 무엇인가요?",
    question_vi: "Nghĩa của '시장' là gì?",
    choices: [
      { ko: "병원", vi: "Bệnh viện" },
      { ko: "학교", vi: "Trường học" },
      { ko: "시장 (Market)", vi: "Chợ" },
      { ko: "공원", vi: "Công viên" },
    ],
    answer_index: 2,
  },
  {
    level_target: "intermediate",
    weight: 2,
    question_ko: "어제 친구를 만___. 자연스러운 형태는?",
    question_vi: "Hôm qua tôi đã gặp bạn. Dạng tự nhiên là?",
    choices: [
      { ko: "났어요", vi: "났어요" },
      { ko: "나요", vi: "나요" },
      { ko: "날 거예요", vi: "날 거예요" },
      { ko: "납니다", vi: "납니다" },
    ],
    answer_index: 0,
  },
  {
    level_target: "advanced",
    weight: 2,
    question_ko: "'발 벗고 나서다'의 의미로 가장 알맞은 것은?",
    question_vi: "Nghĩa thích hợp nhất của thành ngữ '발 벗고 나서다' là?",
    choices: [
      { ko: "신발을 벗고 들어가다", vi: "Cởi giày bước vào" },
      { ko: "적극적으로 도와주다", vi: "Tích cực giúp đỡ" },
      { ko: "급하게 떠나다", vi: "Vội vã rời đi" },
      { ko: "조용히 지켜보다", vi: "Lặng lẽ quan sát" },
    ],
    answer_index: 1,
  },
];

let inserted = 0;
let skipped = 0;
for (const q of QUESTIONS) {
  const existing = await sql`
    select id from mcq_questions
    where version = 'v1' and question_ko = ${q.question_ko}
    limit 1
  `;
  if (existing.length > 0) {
    skipped += 1;
    continue;
  }
  await sql`
    insert into mcq_questions
      (version, level_target, question_ko, question_vi, choices, answer_index, weight, active)
    values
      ('v1', ${q.level_target}::korean_level, ${q.question_ko}, ${q.question_vi},
       ${JSON.stringify(q.choices)}::jsonb, ${q.answer_index}, ${q.weight}, true)
  `;
  inserted += 1;
}
console.log(`mcq seeded: inserted=${inserted}, skipped(existing)=${skipped}`);
