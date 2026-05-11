/**
 * 멀티 테넌트 스코프 헬퍼
 * Phase 1: 모든 요청이 'danang' org에 매핑됨
 * Phase 3: hostname/세션 기반으로 분기
 */

import { headers } from "next/headers";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

const DEFAULT_ORG_SLUG = "danang";
let _defaultOrgIdCache: string | null = null;

async function getDefaultOrgId(): Promise<string> {
  if (_defaultOrgIdCache) return _defaultOrgIdCache;
  const rows = (await sql`
    select id::text from organizations where slug = ${DEFAULT_ORG_SLUG} limit 1
  `) as { id: string }[];
  if (!rows[0]) throw new Error(`Default org '${DEFAULT_ORG_SLUG}' not seeded`);
  _defaultOrgIdCache = rows[0].id;
  return rows[0].id;
}

async function getOrgIdBySlug(slug: string): Promise<string | null> {
  const rows = (await sql`
    select id::text from organizations where slug = ${slug} limit 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function getOrgIdByCustomDomain(domain: string): Promise<string | null> {
  const rows = (await sql`
    select id::text from organizations where custom_domain = ${domain} limit 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * 현재 요청의 org id를 결정한다.
 * 우선순위: 세션 사용자 org > hostname > default
 */
export async function getCurrentOrgId(): Promise<string> {
  // 1) 로그인 사용자가 있으면 그 사용자의 org
  const session = await auth();
  const sessionOrgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (sessionOrgId) return sessionOrgId;

  // 2) hostname 기반 (Phase 3)
  try {
    const h = await headers();
    const host = (h.get("host") ?? "").toLowerCase();
    if (host && !host.endsWith(".vercel.app") && !host.startsWith("localhost")) {
      // 커스텀 도메인 우선
      const byDomain = await getOrgIdByCustomDomain(host);
      if (byDomain) return byDomain;
      // 서브도메인 (예: 'xyz.kacademy.io')
      const sub = host.split(".")[0];
      if (sub && sub !== "kacademy" && sub !== "www") {
        const bySlug = await getOrgIdBySlug(sub);
        if (bySlug) return bySlug;
      }
    }
  } catch {
    // headers() 호출이 불가능한 컨텍스트(스크립트 등) → fallthrough
  }

  // 3) Phase 1 기본값: danang
  return getDefaultOrgId();
}

export async function getCurrentOrg() {
  const id = await getCurrentOrgId();
  const rows = (await sql`
    select id::text, slug, name, display_name, plan, status, timezone, default_locale
    from organizations where id = ${id} limit 1
  `) as Array<{
    id: string;
    slug: string;
    name: string;
    display_name: string | null;
    plan: string;
    status: string;
    timezone: string;
    default_locale: string;
  }>;
  return rows[0] ?? null;
}
