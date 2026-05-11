import { WaitClient } from "./wait-client";

export default async function WaitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl px-6 py-16 lg:py-24 text-center">
      <p className="eyebrow">Step 4 / 4</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">AI가 채점 중이에요</h1>
      <WaitClient id={id} />
    </div>
  );
}
