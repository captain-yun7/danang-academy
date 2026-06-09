"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginForm } from "./login-form";
import { StudentLoginForm } from "../../(portal)/student/login/login-form";

type Role = "student" | "teacher";

export function LoginTabs({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const t = useTranslations("loginPage");
  const [role, setRole] = useState<Role>("student");

  return (
    <div>
      <div
        role="tablist"
        className="grid grid-cols-2 gap-1 rounded-full bg-[var(--color-soft)] p-1"
      >
        {(["student", "teacher"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              role === r
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t(`tabs.${r}`)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {role === "student" ? (
          <StudentLoginForm searchParamsPromise={searchParamsPromise} />
        ) : (
          <LoginForm searchParamsPromise={searchParamsPromise} />
        )}
      </div>
    </div>
  );
}
