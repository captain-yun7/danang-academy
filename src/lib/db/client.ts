import { neon, neonConfig, Pool, type NeonQueryFunction } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

type Sql = NeonQueryFunction<false, false>;

let _sql: Sql | null = null;
function getSql(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  _sql = neon(url);
  return _sql;
}

// 모듈 로드 시점에 neon()을 호출하지 않도록 Proxy로 wrap.
// 빌드 단계엔 env가 비어있어도 OK; 실제 쿼리 시점에만 연결 생성·검증.
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const inst = getSql() as unknown as Record<string | symbol, unknown>;
    const val = inst[prop];
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(inst) : val;
  },
}) as Sql;

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
