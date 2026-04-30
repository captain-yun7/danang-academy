@AGENTS.md

# Da Nang K-Talk Lab (다프 / 다낭 아카데미)

## 제품 요약
베트남 다낭 기반 한국어 학원 + AI 학습 평가 웹서비스. 2026년 5월 말 MVP 오픈 목표.
전체 개요는 `./_docs/overview.md` 참조.

## 이 레포에서 중요한 것
- **완벽함보다 실제 운영 가능한 구조 우선** (원문 §14)
- **Glide 프로토타입이 이미 돌고 있다** — 그 구조를 Next.js로 **이식**하는 게 W1~W2의 핵심.
  이식 매핑표: `./_docs/specs/0414-glide-prototype.md`
- **비용 절감 원칙**: AI는 배치, 실시간 처리 최소화, 대중 입력 무료, 영상 기능 후순위

## 스택
- **Frontend/BFF**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Turbopack
- **DB**: Neon (서버리스 Postgres, DB 브랜칭 활용)
- **Auth**: Auth.js v5 (NextAuth) — Credentials(이메일+비번) + 추후 Zalo/Google
- **오디오 Storage**: Vercel Blob (signed upload URL → 브라우저 직접 PUT)
- **AI 워커**: Python (맥미니 로컬, 별도 레포/폴더 예정) — STT + 발음 평가 + 배치 작업, Neon Postgres 직접 폴링
- **배포**: Vercel (웹), 맥미니 (워커)
- **LLM**: Gemini + OpenAI 병행, 추후 Vercel AI Gateway 도입 검토
- **결정 이력**: 2026-04-30 Supabase → Neon 전환 (DB 브랜칭, Neon MCP 통합, Zalo OAuth 유연성). `_docs/worklogs/2026-04-30.md` 참조

## 디렉토리
- `src/app/` — Next.js App Router 페이지
- `_docs/` — 프로젝트 문서 (심볼릭 → OneDrive)
  - `overview.md`, `specs/`, `runbook/`, `worklogs/`
- `public/` — 정적 자원
- 원본 PDF는 `.gitignore`에 등록 — 레포에는 올리지 않음 (`_docs/specs/`에 정제본만)

## 개발 규칙
- **언어**: 한국어로 대화, 코드 주석도 필요할 때만 한국어로
- **네이밍**: DB는 `snake_case`, TS는 `camelCase`, 파일은 `kebab-case`
- **DB 변경**: `_docs/runbook/init.sql`을 source of truth로 유지. 적용은 Neon MCP의 `prepare_database_migration` → `complete_database_migration` 흐름 사용 (DB 브랜치에 먼저 적용 후 main으로 commit)
- **서버 액션**: 검증(rate limit, 입력 유효성)은 반드시 서버에서 — 클라이언트만 믿지 않기
- **에러 처리**: 시스템 경계(외부 API, 사용자 입력)에서만. 내부 호출은 신뢰.
- **타임존**: 데이터 저장은 `timestamptz` (UTC), 날짜 계산은 `Asia/Ho_Chi_Minh` (VN 기준)

## 절대 하지 말 것
- `DATABASE_URL`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` 등 시크릿을 `NEXT_PUBLIC_*`로 노출
- 클라이언트에서 직접 레이트리밋만 걸고 끝내기 (서버 액션/API 라우트에서 강제)
- 익명 사용자 입력을 클라이언트에서 직접 DB로 쏘지 말기 (Neon은 서버 사이드만 — Vercel/서버 액션 경유)
- Glide 프로토타입과 달라지는 데이터 모델 변경 (이식 단계에서는 그대로 가져오기)

## Phase별 우선순위
1. **W1**: 랜딩 + 회원 DB + 무료 발음 테스트 기본형
2. **W2**: 발음 평가 워커 연결 + 반배정 테스트 + QR 출석
3. **W3**: 관리자 대시보드 + 상담 리드 관리 + 버그 수정
4. **W4**: 실전 테스트 + 안정화 + 오픈
