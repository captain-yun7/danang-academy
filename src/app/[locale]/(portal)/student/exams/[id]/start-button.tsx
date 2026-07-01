"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { startTest } from "../actions";
import { SKILL_ORDER } from "@/lib/exams/scoring";

export function StartButton({ testId, resume }: { testId: string; resume: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await startTest(testId); router.push(`/student/exams/${testId}/${SKILL_ORDER[0]}`); })}
      disabled={pending}
      className="brand-gradient w-full rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
    >
      {pending ? "준비 중…" : resume ? "이어서 응시하기" : "응시 시작하기"}
    </button>
  );
}
