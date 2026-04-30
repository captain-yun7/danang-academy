import { neon, neonConfig, Pool } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const sql = neon(process.env.DATABASE_URL);

let _pool: Pool | null = null;
export function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}
