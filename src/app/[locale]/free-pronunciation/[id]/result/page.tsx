import { ResultClient } from "./result-client";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <p className="eyebrow">Step 3 / 3</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">발음 평가 결과</h1>
      <ResultClient id={id} />
    </div>
  );
}
