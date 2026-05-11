import { ConsultForm } from "./consult-form";

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    testId?: string;
    level?: string;
  }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-6 py-12 lg:py-20">
      <p className="eyebrow">Consult</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">상담 신청</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        이름·전화번호·원하는 반을 남겨주시면 다프 담당자가 24시간 내 연락드려요.
      </p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <ConsultForm
          source={sp.source ?? "landing"}
          sourceTestId={sp.testId}
          recommendedLevel={sp.level}
        />
      </div>
    </div>
  );
}
