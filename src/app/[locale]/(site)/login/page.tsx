import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 lg:py-24">
      <p className="eyebrow">Admin Login</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">관리자 로그인</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        다프 운영진 전용 페이지입니다. 학생/방문자는 로그인 없이 무료 테스트를
        이용할 수 있어요.
      </p>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <LoginForm searchParamsPromise={searchParams} />
      </div>
    </div>
  );
}
