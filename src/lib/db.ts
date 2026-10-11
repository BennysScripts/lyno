import { Pool, type PoolClient, type QueryResultRow } from "pg";
const globalDb = globalThis as unknown as { lynoPool?: Pool };
export const pool =
  globalDb.lynoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
if (process.env.NODE_ENV !== "production") globalDb.lynoPool = pool;
export type DB = PoolClient;
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
) {
  return (await pool.query<T>(sql, params)).rows;
}
export async function transaction<T>(
  run: (db: DB) => Promise<T>,
  tenantId?: string,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    if (tenantId)
      await db.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function rows<T extends QueryResultRow = QueryResultRow>(
  db: DB,
  sql: string,
  params: unknown[] = [],
) {
  return (await db.query<T>(sql, params)).rows;
}
