"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!role || !organizationId || !["super_admin", "owner", "manager"].includes(role)) {
    throw new Error("forbidden");
  }
  return { role, organizationId };
}

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, hyphen");

const upsertSchema = z.object({
  slug: slugSchema,
  titleKo: z.string().trim().min(1).max(80),
  titleVi: z.string().trim().min(1).max(80),
  levelLabelKo: z.string().trim().min(1).max(40),
  levelLabelVi: z.string().trim().min(1).max(40),
  descKo: z.string().trim().min(1).max(400),
  descVi: z.string().trim().min(1).max(400),
  rating: z.number().min(0).max(5),
  sessions: z.number().int().min(1).max(999),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean().default(true),
});

export async function createCourse(input: z.infer<typeof upsertSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  // 같은 학원에 동일 slug 중복 방지
  const dup = (await sql`
    select id from course_catalog where organization_id = ${organizationId} and slug = ${d.slug} limit 1
  `) as { id: string }[];
  if (dup[0]) throw new Error("slug_taken");

  const inserted = (await sql`
    insert into course_catalog
      (slug, title_ko, title_vi, level_label_ko, level_label_vi,
       desc_ko, desc_vi, rating, sessions, sort_order, active, organization_id)
    values
      (${d.slug}, ${d.titleKo}, ${d.titleVi}, ${d.levelLabelKo}, ${d.levelLabelVi},
       ${d.descKo}, ${d.descVi}, ${d.rating}, ${d.sessions}, ${d.sortOrder}, ${d.active}, ${organizationId})
    returning id::text
  `) as { id: string }[];

  revalidatePath("/admin/courses");
  revalidatePath("/", "layout");
  redirect(`/admin/courses/${inserted[0].id}`);
}

const updateSchema = upsertSchema.extend({ id: z.string().uuid() });

export async function updateCourse(input: z.infer<typeof updateSchema>) {
  const { organizationId } = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  const d = parsed.data;

  await sql`
    update course_catalog set
      slug = ${d.slug},
      title_ko = ${d.titleKo}, title_vi = ${d.titleVi},
      level_label_ko = ${d.levelLabelKo}, level_label_vi = ${d.levelLabelVi},
      desc_ko = ${d.descKo}, desc_vi = ${d.descVi},
      rating = ${d.rating}, sessions = ${d.sessions},
      sort_order = ${d.sortOrder}, active = ${d.active}
    where id = ${d.id} and organization_id = ${organizationId}
  `;

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${d.id}`);
  revalidatePath("/", "layout");
}

export async function toggleCourseActive(input: { id: string; active: boolean }) {
  const { organizationId } = await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");
  await sql`
    update course_catalog set active = ${parsed.data.active}
    where id = ${parsed.data.id} and organization_id = ${organizationId}
  `;
  revalidatePath("/admin/courses");
  revalidatePath("/", "layout");
}

export async function deleteCourse(id: string) {
  const { organizationId } = await requireAdmin();
  await sql`
    delete from course_catalog where id = ${id} and organization_id = ${organizationId}
  `;
  revalidatePath("/admin/courses");
  revalidatePath("/", "layout");
  redirect("/admin/courses");
}
