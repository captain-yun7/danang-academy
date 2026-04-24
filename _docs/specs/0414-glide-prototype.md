# 0414 Glide 프로토타입 구조 (마이그레이션 원본)

> 원문: `/0414다낭메뉴얼.pdf` (2026-04-14, 72p)
> 이 문서의 구조와 로직을 Next.js + Supabase로 **그대로 이식**하는 것이 W1~W2 목표.

## 스택 (현재)
- **데이터**: Google Sheets (`FreePronunciationRequests` 시트)
- **앱**: Glide (노코드 모바일 웹앱)
- **채점**: 맥미니 + Python 백엔드가 Pending 행을 폴링

## 원본 시트 스키마 (이식 대상)

| 컬럼 | 용도 | 마이그레이션 매핑 |
|---|---|---|
| `REQUEST_ID` | 각 요청 고유 번호 | `id` (uuid) |
| `NAME` | 사용자 이름/별명 | `name` |
| `NATIVE_LANGUAGE` | 모국어 (베트남어/영어 등) | `native_language` enum |
| `KOREAN_LEVEL` | 한국어 수준 (초급/중급/고급) | `korean_level` enum |
| `TARGET_SENTENCE` | 화면에 고정되어 나타났던 정답 문장 | `target_sentence` |
| `TRANSCRIPT` | STT 전사 결과 | `transcript` |
| `STATUS` | Pending / Completed | `status` enum |
| `CREATED_AT` | 제출 시간 | `created_at` timestamptz |

## 앱 내부 로직 (이식 대상)

### 1. 하루 5회 제한
- `TEMP LAST SUBMIT DATE` (사용자별 마지막 제출일)
- `TEMP DAILY COUNT` (오늘 제출 횟수)
- **If**: `TEMP LAST SUBMIT DATE ≠ TODAY` → 카운트 1로 초기화, 1회 제출
- **Else If**: `TEMP DAILY COUNT < 5` → 카운트 +1, 제출
- **Else**: "오늘 5회 테스트를 모두 사용하셨습니다." 알림, 데이터 전송 X

### 2. 수준별 랜덤 문장 뽑기 (3단계 Glide 수식)
1. `REL SENTENCES BY LEVEL` (Relation) — 유저의 `TEMP KOREAN LEVEL`과 문장 원본 시트의 `Level` 컬럼 매칭, **Match multiple 체크** (여러 문장 묶기)
2. `LOOKUP ALL TEXTS` (Lookup) — 위 Relation에서 한국어 문장 컬럼만 추출 (리스트화)
3. `RANDOM PURE TEXT` (Single Value, Random) — 리스트 중 하나 랜덤 선택

**Postgres 등가**:
```sql
SELECT text FROM sentences
WHERE level = :korean_level
ORDER BY random() LIMIT 1;
```

### 3. 화면 전환 (Glide Visibility → Next 컴포넌트 조건부 렌더)
- 이름 입력 전: 레벨 선택/녹음 버튼 **숨김**
- 이름 입력 후: 후속 UI 노출
- → React에서는 `name` state 기반 조건 렌더

### 4. 제출 흐름 (Glide Custom Action → Next Server Action)
1. 횟수 검증
2. `FreePronunciationRequests`에 행 추가 (status=Pending)
3. TEMP 값 초기화 (NAME 제외)
4. "제출 성공!" 토스트

### 5. 백엔드 채점 (맥미니 Python Worker — 유지)
1. `status=Pending` 행 폴링
2. 음성 파일 다운로드 → STT
3. TRANSCRIPT 기록
4. AI 발음 평가 → 점수·피드백 생성
5. `status=Completed` 업데이트

## 이식 시 주의점
- **Glide의 TEMP 변수는 브라우저 세션/로컬스토리지 또는 서버 세션으로 재구현** 필요
- **하루 5회 제한은 DB/서버에서 강제** (클라이언트만 믿지 않기) — IP + 이름 기반 또는 익명 세션 기반
- **"Pending → Completed 폴링"은 유지하되** Supabase Realtime 또는 Vercel Queues로 점진적 개선 가능
- 문장 마스터는 별도 `sentences` 테이블로 분리 (현재는 원본 시트에 있음)

## 검증된 것 / 아직 없는 것
**검증됨 (프로토타입에서 동작 중)**
- 유저 입력 → Pending 행 생성 → 워커 채점 → Completed 갱신
- 수준별 랜덤 문장 뽑기
- 하루 5회 제한 (클라이언트 측)

**아직 없음 (MVP에서 추가)**
- 서버 측 제출 제한 (남용 방지)
- 결과 화면 (점수, 강점, 개선점, 추천 반, 상담 유도 CTA)
- 반배정 테스트 (객관식 5 + 발음 1)
- QR 출석
- 관리자 대시보드
- 랜딩 페이지
