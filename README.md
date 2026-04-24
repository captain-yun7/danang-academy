# Da Nang K-Talk Lab

베트남 다낭 기반 한국어 학원(다프) + AI 학습 평가 웹서비스.

- **오픈 목표**: 2026년 5월 말
- **상태**: MVP 개발 중 (W1)
- **스택**: Next.js 16 + Supabase + Python AI Worker(맥미니)

## 빠른 시작

```bash
pnpm install
cp .env.example .env.local    # 값 채우기
pnpm dev                       # http://localhost:3000
```

## 문서
- [프로젝트 개요](./_docs/overview.md)
- [MVP 스펙](./_docs/specs/0420-mvp-spec.md)
- [Glide 프로토타입 → Next 이식 매핑](./_docs/specs/0414-glide-prototype.md)
- [DB 스키마](./_docs/specs/db-schema.md) · [초기 SQL](./_docs/runbook/init.sql)
- [웹↔워커 API 계약](./_docs/specs/api-contract.md)
- [환경 변수](./_docs/runbook/env.md) · [아키텍처](./_docs/runbook/architecture.md)
- [작업 일지](./_docs/worklogs/)

AI 에이전트용 가이드: [CLAUDE.md](./CLAUDE.md)
