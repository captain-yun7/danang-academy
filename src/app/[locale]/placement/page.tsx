import { StartForm } from "./start-form";

export default function PlacementIntroPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12 lg:py-20">
      <p className="eyebrow">Placement Test</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">무료 레벨 테스트</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        객관식 5문항 + 발음 1문장으로 입문/초급/중급/고급 추천 반을 알려드려요.
        총 5분이면 끝나요. (하루 5회 제한)
      </p>

      <ol className="mt-6 grid gap-3 text-sm">
        <li className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3">
          <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
            1
          </span>
          <span>이름·모국어 입력</span>
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3">
          <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
            2
          </span>
          <span>객관식 5문항 — 약 2분</span>
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3">
          <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
            3
          </span>
          <span>한국어 한 문장 따라 읽기 — 30초</span>
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3">
          <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
            4
          </span>
          <span>AI 채점 → 추천 반 안내</span>
        </li>
      </ol>

      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <StartForm />
      </div>
    </div>
  );
}
