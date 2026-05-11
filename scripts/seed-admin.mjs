// 어드민 시드 사용자 1명 INSERT (멱등)
// 사용: ADMIN_SEED_EMAIL=foo@bar ADMIN_SEED_PASSWORD=xxxx ADMIN_SEED_NAME=홍길동 \
//        node --env-file=.env.local scripts/seed-admin.mjs

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME ?? "Admin";
const role = process.env.ADMIN_SEED_ROLE ?? "owner";
const orgSlug = process.env.ADMIN_SEED_ORG ?? "danang";

if (!email || !password) {
  console.error(
    "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set (in .env.local or environment)"
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_SEED_PASSWORD must be at least 8 characters");
  process.exit(1);
}

const sql = neon(url);
const hash = await bcrypt.hash(password, 10);

const orgRows = await sql`select id::text from organizations where slug = ${orgSlug} limit 1`;
if (orgRows.length === 0) {
  console.error(`organization slug '${orgSlug}' not found`);
  process.exit(1);
}
const organizationId = orgRows[0].id;

const existing = await sql`select id from users where email = ${email} limit 1`;

if (existing.length > 0) {
  await sql`
    update users
    set password_hash = ${hash}, name = ${name}, role = ${role}::user_role,
        organization_id = ${organizationId},
        email_verified = coalesce(email_verified, now())
    where email = ${email}
  `;
  console.log(`updated existing user: ${email} (role=${role}, org=${orgSlug})`);
} else {
  const inserted = await sql`
    insert into users (email, password_hash, name, role, organization_id, email_verified)
    values (${email}, ${hash}, ${name}, ${role}::user_role, ${organizationId}, now())
    returning id
  `;
  console.log(`seeded admin: ${email} → ${inserted[0].id} (role=${role}, org=${orgSlug})`);
}
