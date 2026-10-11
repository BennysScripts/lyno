import { rows, type DB } from "./db";
import type { Context } from "./security";
export async function insights(db: DB, ctx: Context, days = 30) {
  const [summary] = await rows<{
    total: number;
    active: number;
    completed: number;
    canceled: number;
    avg_hours: string | null;
  }>(
    db,
    `SELECT count(*)::int AS total,count(*) FILTER(WHERE status='active')::int AS active,count(*) FILTER(WHERE status='completed')::int AS completed,count(*) FILTER(WHERE status='canceled')::int AS canceled,round(avg(extract(epoch FROM (completed_at-created_at))/3600) FILTER(WHERE status='completed')::numeric,1) AS avg_hours FROM workflows WHERE tenant_id=$1 AND created_at>=now()-$2*interval '1 day'`,
    [ctx.tenantId, days],
  );
  const [overdue] = await rows(
    db,
    "SELECT count(*)::int AS count FROM tasks t JOIN workflows w ON w.id=t.workflow_id AND w.tenant_id=t.tenant_id WHERE t.tenant_id=$1 AND t.status IN ('ready','pending') AND t.due_at<now() AND w.status='active' AND w.created_at>=now()-$2*interval '1 day'",
    [ctx.tenantId, days],
  );
  const weekly = await rows(
    db,
    `SELECT d::date::text AS date,count(w.id)::int AS started,count(w.id) FILTER(WHERE w.status='completed')::int AS completed FROM generate_series(current_date-($2::int-1),current_date,'1 day') d LEFT JOIN workflows w ON w.tenant_id=$1 AND w.created_at::date=d::date GROUP BY d ORDER BY d`,
    [ctx.tenantId, days],
  );
  const bottlenecks = await rows(
    db,
    `SELECT t.title,count(*)::int AS count,round(avg(extract(epoch FROM (now()-w.created_at))/86400)::numeric,1) AS age_days FROM tasks t JOIN workflows w ON w.id=t.workflow_id AND w.tenant_id=t.tenant_id WHERE t.tenant_id=$1 AND t.status='ready' AND w.status='active' AND w.created_at>=now()-$2*interval '1 day' GROUP BY t.title ORDER BY count DESC,age_days DESC LIMIT 8`,
    [ctx.tenantId, days],
  );
  const processes = await rows(
    db,
    `SELECT coalesce(t.name,'Eigener Ablauf') AS name,count(w.id)::int AS total,count(w.id) FILTER(WHERE w.status='completed')::int AS completed,round(avg(extract(epoch FROM (w.completed_at-w.created_at))/3600) FILTER(WHERE w.status='completed')::numeric,1) AS avg_hours FROM workflows w LEFT JOIN templates t ON t.id=w.template_id AND t.tenant_id=w.tenant_id WHERE w.tenant_id=$1 AND w.created_at>=now()-$2*interval '1 day' GROUP BY t.name ORDER BY total DESC`,
    [ctx.tenantId, days],
  );
  return {
    summary: { ...summary, overdue: overdue.count },
    weekly,
    bottlenecks,
    processes,
    days,
  };
}
