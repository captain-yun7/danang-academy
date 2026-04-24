# 아키텍처

## 배포 구조

```
┌─────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│ 방문자/학생 │───────→│   Vercel (Next.js)   │───────→│  Supabase          │
│ 브라우저    │        │   - Landing          │        │  - Postgres        │
│             │        │   - Free Pron Test   │        │  - Auth            │
│             │        │   - Placement Test   │        │  - Storage (audio) │
│             │        │   - QR scan page     │        │  - Realtime        │
│             │        │   - Admin dashboard  │        │                    │
└─────────────┘        └──────────────────────┘        └─────────┬──────────┘
                                                                  │ polling/realtime
                                                                  ▼
                                                       ┌────────────────────┐
                                                       │ 맥미니 (자택/학원)  │
                                                       │  Python AI Worker  │
                                                       │  - STT             │
                                                       │  - 발음 평가       │
                                                       │  - 반배정 계산     │
                                                       │  - (Phase 2) 주간  │
                                                       │    리포트 생성     │
                                                       └─────────┬──────────┘
                                                                  │
                                                                  ▼
                                                       ┌────────────────────┐
                                                       │ OpenAI / Gemini    │
                                                       └────────────────────┘
```

## 런타임 선택
- **Next.js 런타임**: 기본 Node (Fluid Compute). Edge 런타임은 필요 시에만.
- **함수 타임아웃**: 기본 300s로 충분. 실제 채점은 워커가 하므로 웹 함수는 수 초 내 끝남.
- **파일 업로드**: Supabase Storage signed URL로 브라우저 직접 업로드 (서버 대역폭 절약)

## 왜 Supabase?
1. Auth + Postgres + Storage + Realtime을 한 번에
2. Vercel Marketplace 연동 간단
3. 무료 티어가 MVP 운영에 충분
4. `RLS`로 데이터 보안 확보

## 왜 워커 분리?
1. AI 채점은 수 초~수십 초 소요 → Vercel 함수에서 직접 처리하면 비용/타임아웃 리스크
2. 맥미니는 **이미 Glide 프로토타입에서 사용 중** — 재활용
3. 배치 처리 최적화로 API 비용 절감 (MVP 원칙)

## 도메인 (예정)
- Production: `danang-academy.com` (또는 유사)
- Preview: `*.vercel.app`

## 모니터링 (MVP 범위 밖, 오픈 직전 추가)
- Vercel Analytics (무료)
- Supabase Dashboard 로그
- 상용 APM은 Phase 2 이후
