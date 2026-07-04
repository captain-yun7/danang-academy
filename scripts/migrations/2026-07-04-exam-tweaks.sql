-- 주간 시험 보완: 듣기 문항별 TTS 속도(기본 0.5)
-- 적용: POST /api/admin/migrate. 멱등.

alter table weekly_questions
  add column if not exists tts_speed numeric(3,2) not null default 0.5;
