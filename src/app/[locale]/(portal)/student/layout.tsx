import { getStudentSession } from "@/lib/auth/student";
import { PortalHeader } from "./portal-header";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getStudentSession();
  return (
    <div className="flex min-h-full flex-col bg-[var(--color-soft)]">
      {s && <PortalHeader name={s.name} code={s.studentCode} />}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
