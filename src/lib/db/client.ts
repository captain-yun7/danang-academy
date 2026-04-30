import { neon, neonConfig, Pool } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

// 빌드 단계엔 DATABASE_URL이 없을 수 있어 모듈 로드 시점에 throw하지 않음.
// 실제 쿼리 시점(런타임)에 neon이 알아서 에러 냄.
export const sql = neon(process.env.DATABASE_URL ?? "postgresql://placeholder");

let _pool: Pool | null = null;
export function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}
