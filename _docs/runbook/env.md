# 환경 변수 가이드

## .env.local (로컬 개발)
`.env.example`을 복사해서 값을 채운다.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=              # 서버 액션에서만 사용, 클라이언트 노출 금지

# AI (워커에서도 공유)
OPENAI_API_KEY=
GEMINI_API_KEY=

# 사이트
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TZ=Asia/Ho_Chi_Minh                      # 베트남 시간대 기준 날짜 계산
```

## Vercel 환경 변수
배포 환경: `Production` / `Preview` / `Development`
- Supabase는 Vercel Marketplace에서 통합 설치 시 자동 주입
- `OPENAI_API_KEY`, `GEMINI_API_KEY`는 수동 추가

```bash
vercel env pull .env.local  # Vercel 값 로컬로 가져오기
```

## Python 워커 (.env)
맥미니에서 실행하는 워커용.

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=              # 워커는 서버 키 필요 (RLS 우회)
OPENAI_API_KEY=
GEMINI_API_KEY=
POLL_INTERVAL_SECONDS=3
```

## 보안 원칙
- `SUPABASE_SERVICE_ROLE_KEY`는 **절대 NEXT_PUBLIC_ 접두어 금지**
- `.env*.local`은 git에 포함하지 않음 (`.gitignore` 확인)
- 키 유출 의심 시 Supabase/OpenAI/Gemini 대시보드에서 즉시 회전
