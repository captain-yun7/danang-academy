/**
 * 매주 일요일 자정(VN 기준) 실행되는 cron — 모든 활성 반에 다음 4주 회차 보충.
 * 멱등 — generator가 unique 인덱스로 중복 INSERT skip.
 *
 * 보안: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더 주입.
 *      로컬 트리거는 같은 헤더로 보호.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { generateSessions } from "@/lib/sessions/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron이 인증 헤더 자동 주입 — CRON_SECRET 비교
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 활성 org의 활성 반 모두 — recurring_pattern이 채워진 것만
  const classes = (await sql`
    select c.id::text, c.organization_id::text
    from classes c
    join organizations o on o.id = c.organization_id
    where o.status in ('active', 'trial')
      and c.recurring_pattern ? 'days'
      and c.recurring_pattern->'days' != '[]'::jsonb
  `) as { id: string; organization_id: string }[];

  let total = 0;
  let failed = 0;
  const results: Array<{ classId: string; generated: number; skipped: number }> = [];
  for (const c of classes) {
    try {
      const r = await generateSessions({
        classId: c.id,
        organizationId: c.organization_id,
        weeks: 4,
      });
      total += r.generated;
      results.push({ classId: c.id, generated: r.generated, skipped: r.skipped });
    } catch (e) {
      failed += 1;
      console.error("generate failed for class", c.id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    classes_processed: classes.length,
    sessions_generated: total,
    classes_failed: failed,
    detail: results,
  });
}
