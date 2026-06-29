import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ROLES = ["super_admin", "owner", "manager"] as const;

// scripts/migrations/2026-06-29-assessment-linking.sql 과 동일한 내용 — 파일은 문서/이력용, 실행은 이 배열.
// 멱등 SQL이므로 재실행 안전. neon http 드라이버는 statement 1개씩 실행.
// (이전 마이그레이션들은 이미 적용 완료 — 멱등이므로 필요 시 해당 파일/이력에서 재실행)
const STATEMENTS: string[] = [
  `alter table assessment_rounds
    add column if not exists pronunciation_assignment_id uuid references assignments(id) on delete set null,
    add column if not exists writing_assignment_id uuid references assignments(id) on delete set null`,
];

export async function POST() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results: { statement_index: number; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < STATEMENTS.length; i++) {
    try {
      await sql.query(STATEMENTS[i]);
      results.push({ statement_index: i, ok: true });
    } catch (e) {
      results.push({
        statement_index: i,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
