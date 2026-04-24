# Da Nang K-Talk Lab — Overview

## 제품
베트남 다낭 기반 한국어 학원(다프, Da Nang Phonology) + AI 학습 평가 웹서비스.

## 목표
- **오픈**: 2026년 5월 말
- **원칙**: 완성형이 아닌 오픈 가능한 MVP 우선, 비용 절감 우선
- **가장 급한 3개**: 무료 발음 테스트 → 반배정 테스트 → QR 출석

## MVP 5개 (5월 말 오픈 필수)
1. 랜딩 페이지 — 무료 테스트 유입 + 상담 전환
2. 무료 발음 테스트 — 문장 제시 → 녹음 → STT → AI 평가 → 점수·피드백 → 상담 유도
3. 무료 반배정 테스트 — 객관식 5문항 + 발음 1문장 → 입문/초급/중급/고급 자동 추천
4. QR 입출석 — 학생 QR 발급 → 입실/퇴실 스캔 → DB 기록 → 관리자 반영
5. 관리자 대시보드 — 총 학생 수, 오늘 출석률, 무료 테스트 수, 상담 전환 수, 평균 발음 점수, 반별 인원

## 현재 단계
- Glide + 구글시트로 **무료 발음 테스트 프로토타입 완성** (2026-04-14 메뉴얼 기준)
- 하루 5회 제한, 수준별 랜덤 문장, Pending→Completed 폴링 구조 검증 완료
- Next.js 실서비스로 이식 중 (이 레포)

## 기술 스택
| 계층 | 선택 |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind |
| DB | Supabase (PostgreSQL) |
| AI | Gemini + OpenAI 병행 |
| Worker | Python AI Worker (맥미니 로컬) — STT, 발음 평가, 반배정 결과 생성, 주간 리포트, TOPIK 작문 |
| QR | 웹 QR 체크인 |
| Hosting | Vercel (웹) + Cloud/로컬 (워커) |

## 비용 절감 원칙
- 대중(방문자) 입력은 전부 무료
- AI는 **배치 처리 우선** — 실시간 처리 최소화
- 유료 기능은 관리자만 사용
- 영상 기능은 후순위

## Phase 2 (오픈 후)
- 수업 후 복습 시스템 (오늘 배운 문장 자동 제공, TTS, 녹음 제출, AI 평가)
- 주간 리포트 (출석률/발음 향상도/숙제 수행률/강사 코멘트)

## Phase 3
- TOPIK 지원 (읽기/듣기/쓰기/작문 피드백/예상 점수)
- 작문 평가 (AI 문법·논리·표현 다양성 + 점수 + 수정본)

## 권한 체계
`SUPER_ADMIN > OWNER > MANAGER > TEACHER > STUDENT > VISITOR`

## 참고 원문
- `./_docs/specs/0420-mvp-spec.md` (0420 다프 MVP 상세 개발 문서 v1 정제본)
- `./_docs/specs/0414-glide-prototype.md` (Glide 프로토타입 구조 — 마이그레이션 원본)
