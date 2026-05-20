// 코스 카탈로그 조회 헬퍼 — DB(course_catalog) 에서 로케일에 맞춰 가져옴.
// 메인 페이지 카드, 코스 상세 페이지, 어드민 등 모든 코스 소비처가 이 모듈 사용.

import { sql } from "@/lib/db/client";
import { getCurrentOrgId } from "@/lib/auth/scope";

export type CourseLocale = "ko" | "vi";

export type Course = {
  id: string;
  slug: string;
  title: string;
  levelLabel: string;
  desc: string;
  rating: number;
  sessions: number;
  sortOrder: number;
  active: boolean;
};

type Row = {
  id: string;
  slug: string;
  title_ko: string;
  title_vi: string;
  level_label_ko: string;
  level_label_vi: string;
  desc_ko: string;
  desc_vi: string;
  rating: string;
  sessions: number;
  sort_order: number;
  active: boolean;
};

function project(row: Row, locale: CourseLocale): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: locale === "vi" ? row.title_vi : row.title_ko,
    levelLabel: locale === "vi" ? row.level_label_vi : row.level_label_ko,
    desc: locale === "vi" ? row.desc_vi : row.desc_ko,
    rating: Number(row.rating),
    sessions: row.sessions,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

/** 메인 사이트 카드용 — active 코스만 정렬 순서대로 */
export async function getActiveCourses(locale: CourseLocale): Promise<Course[]> {
  const orgId = await getCurrentOrgId();
  const rows = (await sql`
    select id::text, slug,
           title_ko, title_vi, level_label_ko, level_label_vi,
           desc_ko, desc_vi, rating::text, sessions, sort_order, active
    from course_catalog
    where organization_id = ${orgId} and active = true
    order by sort_order, created_at
  `) as Row[];
  return rows.map((r) => project(r, locale));
}

/** 코스 상세 페이지 — slug 로 단건 조회 (active 무관) */
export async function getCourseBySlug(
  slug: string,
  locale: CourseLocale
): Promise<Course | null> {
  const orgId = await getCurrentOrgId();
  const rows = (await sql`
    select id::text, slug,
           title_ko, title_vi, level_label_ko, level_label_vi,
           desc_ko, desc_vi, rating::text, sessions, sort_order, active
    from course_catalog
    where organization_id = ${orgId} and slug = ${slug}
    limit 1
  `) as Row[];
  if (rows.length === 0) return null;
  return project(rows[0], locale);
}
