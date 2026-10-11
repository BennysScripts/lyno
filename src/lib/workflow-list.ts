import { z } from "zod";
import { rows, type DB } from "./db";
import { type Context } from "./security";
export async function workflowList(db: DB, ctx: Context, input: unknown) {
  const d = z
    .object({
      search: z.string().max(160).default(""),
      status: z.enum(["all", "active", "completed", "canceled"]).default("all"),
      priority: z
        .enum(["all", "low", "normal", "high", "urgent"])
        .default("all"),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    })
    .parse(input);
  const params = [ctx.tenantId, d.search, d.status, d.priority];
  const filter =
    "w.tenant_id=$1 AND ($2='' OR w.name ILIKE '%'||$2||'%') AND ($3='all' OR w.status=$3) AND ($4='all' OR w.priority=$4)";
  const [count] = await rows(
    db,
    `SELECT count(*)::int AS total FROM workflows w WHERE ${filter}`,
    params,
  );
  const items = await rows(
    db,
    `SELECT w.*,u.name AS creator_name FROM workflows w LEFT JOIN users u ON u.id=w.created_by WHERE ${filter} ORDER BY w.created_at DESC,w.id LIMIT 25 OFFSET $5`,
    [...params, (d.page - 1) * 25],
  );
  const tasks = await rows(
    db,
    "SELECT * FROM tasks WHERE tenant_id=$1 AND workflow_id=ANY($2::uuid[]) ORDER BY position",
    [ctx.tenantId, items.map((w) => w.id)],
  );
  return { items, tasks, total: count.total, page: d.page, pageSize: 25 };
}
