# API 계약 (웹 ↔ Python 워커)

## 원칙
- **웹(Next.js)은 Supabase와 직접 통신** — 클라이언트/서버 컴포넌트에서 `@supabase/ssr` 사용
- **워커(Python)는 Supabase를 폴링하거나 Realtime 구독** — 별도 HTTP API 불필요
- 결합도 낮추기 위해 웹과 워커는 **DB(테이블)를 통한 메시지 패싱**

## 무료 발음 테스트 플로우

```
[브라우저]                [Next.js Server Action]         [Supabase]              [Python Worker]
   │                           │                            │                           │
   │─ 이름/레벨/모국어 제출 ──→│                            │                           │
   │                           │─ insert fpt (pending) ────→│                           │
   │←── id, target_sentence ───│                            │                           │
   │                           │                            │                           │
   │─ 녹음 후 오디오 업로드 ──→ storage direct upload ──────→│                           │
   │                           │                            │                           │
   │─ audio_url PATCH ────────→│─ update fpt ─────────────→│                           │
   │                           │                            │                           │
   │                           │                            │← poll status=pending ─────│
   │                           │                            │─ row ─────────────────────→│
   │                           │                            │                          STT
   │                           │                            │                         AI 평가
   │                           │                            │←─ update: score, etc ─────│
   │                           │                            │   status=completed        │
   │                           │                            │                           │
   │─ 결과 폴링 ──────────────→│─ select fpt where id ─────→│                           │
   │←── 점수/피드백/추천 ─────│                            │                           │
```

### 단계별 계약

#### 1) 테스트 시작
**Server Action**: `startFreePronunciationTest(input)`

```ts
type StartInput = {
  visitorName: string;
  nativeLanguage: 'vi' | 'en' | 'other';
  koreanLevel: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
};

type StartResult =
  | { ok: true; id: string; targetSentence: string; uploadToken: string }
  | { ok: false; error: 'rate_limited' | 'invalid_input' };
```

서버가:
1. 하루 5회 제한 체크 (fingerprint 기준)
2. 레벨에 맞는 `sentences`에서 랜덤 1개 선택
3. `free_pronunciation_tests` INSERT (status=pending, target_sentence)
4. Supabase Storage 업로드용 signed URL 발급

#### 2) 오디오 업로드
브라우저가 signed URL로 직접 PUT → Supabase Storage (`audio/free-pronunciation/{id}.webm`)

#### 3) 업로드 완료 알림
**Server Action**: `submitAudio(id, audioPath)`
- `audio_url` 업데이트 → 워커가 이 시점부터 처리 가능

#### 4) 워커 처리 (Python)
```python
# 의사코드
while True:
    rows = supabase.table('free_pronunciation_tests')\
        .select('*')\
        .eq('status', 'pending')\
        .not_.is_('audio_url', 'null')\
        .limit(10).execute().data
    for row in rows:
        supabase.table('free_pronunciation_tests')\
            .update({'status': 'processing'}).eq('id', row['id']).execute()
        try:
            transcript = stt(download(row['audio_url']))
            result = evaluate_pronunciation(row['target_sentence'], transcript)
            supabase.table('free_pronunciation_tests').update({
                'status': 'completed',
                'transcript': transcript,
                'score': result.score,
                'strengths': result.strengths,
                'improvements': result.improvements,
                'recommended_class_level': result.recommended_level,
            }).eq('id', row['id']).execute()
        except Exception as e:
            supabase.table('free_pronunciation_tests')\
                .update({'status': 'failed'}).eq('id', row['id']).execute()
    time.sleep(3)
```

#### 5) 결과 폴링 (브라우저)
- Next.js 서버 컴포넌트 또는 Supabase Realtime 구독
- `status=completed` 되면 점수/피드백/추천 반 표시 + 상담 CTA 노출

## 반배정 테스트 플로우
1. 객관식 5문항 즉시 채점 (서버) → `mcq_score` 기록
2. 발음 1문장은 위 플로우 재사용 (`pronunciation_test_id`로 연결)
3. 둘 다 완료되면 워커가 `recommended_level` 계산해서 `placement_tests` 업데이트

## QR 출석 플로우
1. 학생 QR 생성: `students.qr_token` → QR 코드 생성 (`https://danang-academy.example/qr/{token}`)
2. 학원 내 스캔 디바이스(교사 폰/태블릿)가 URL 접근 → Next.js 라우트가 토큰으로 학생 조회
3. 최근 attendance_logs 조회:
   - 오늘 check_in 없으면 → check_in 기록
   - check_in 있고 check_out 없으면 → check_out 기록
   - 모두 있으면 → "이미 퇴실 처리됨"
4. 관리자 대시보드 실시간 반영 (Realtime)

## 레이트 리밋 체크
```sql
-- 오늘 이 fingerprint로 몇 번 제출됐는지
select count(*) from free_pronunciation_tests
where visitor_fingerprint = :fp
  and created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
  and created_at <  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day';
-- >= 5 이면 차단
```
