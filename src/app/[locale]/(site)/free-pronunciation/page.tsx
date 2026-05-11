import { StartForm } from "./start-form";

export default function Page() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12 lg:py-20">
      <p className="eyebrow">Free Pronunciation Test</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
        무료 발음 테스트
      </h1>
      <p className="mt-3 text-[var(--color-muted)]">
        이름과 한국어 수준을 선택하면 한 문장을 보여드립니다. 따라 읽고 녹음하면
        AI가 점수와 개선점을 알려드려요. (하루 5회 제한)
      </p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <StartForm />
      </div>
    </div>
  );
}
