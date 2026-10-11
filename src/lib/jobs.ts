import { query, transaction, rows } from "./db";
import { startWorkflow } from "./flow";
import { hasAccess } from "./entitlements";
import { settingsSchema } from "./customization";
import type { Context } from "./security";
export async function runJobs(tenantIds?: string[]) {
  const orgs = await query(
    "SELECT * FROM organizations WHERE ($1::uuid[] IS NULL OR id=ANY($1))",
    [tenantIds ?? null],
  );
  let reminders = 0,
    runs = 0;
  for (const org of orgs)
    await transaction(async (db) => {
      // Database lock prevents overlapping workers from producing duplicate occurrences.
      const [lock] = await rows(
        db,
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
        [org.id],
      );
      if (!lock.acquired) return;
      const [owner] = await rows(
        db,
        "SELECT u.id,u.email,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.role='owner' ORDER BY m.created_at LIMIT 1",
        [org.id],
      );
      if (!owner) return;
      const ctx: Context = {
        tenantId: org.id,
        userId: owner.id,
        email: owner.email,
        name: owner.name,
        role: "owner",
        verified: true,
        sessionHash: "",
      };
      const templates = await rows(
        db,
        "SELECT * FROM templates WHERE tenant_id=$1 AND active AND recurrence_days IS NOT NULL AND next_run_at<=now() FOR UPDATE",
        [org.id],
      );
      for (const t of hasAccess(org as Parameters<typeof hasAccess>[0]) &&
      (org.subscription_status === "trialing" || org.modules.includes("flow"))
        ? templates
        : []) {
        await startWorkflow(db, ctx, {
          templateId: t.id,
          name: `${t.name} · ${new Date().toLocaleDateString("de-DE")}`,
          formData: {},
        });
        await db.query(
          "UPDATE templates SET next_run_at=now()+recurrence_days*interval '1 day' WHERE tenant_id=$1 AND id=$2",
          [org.id, t.id],
        );
        runs++;
      }
      const result = await db.query(
        `INSERT INTO notifications(tenant_id,user_id,title,href,dedupe_key) SELECT t.tenant_id,coalesce(t.assignee_id,$2::uuid),'Aufgabe fällig: '||t.title,'/app/flow?id='||t.workflow_id,'due:'||t.id||':'||current_date FROM tasks t JOIN workflows w ON w.id=t.workflow_id AND w.tenant_id=t.tenant_id WHERE t.tenant_id=$1 AND t.status='ready' AND t.due_at<now()+$3*interval '1 day' AND w.status='active' AND NOT EXISTS(SELECT 1 FROM user_preferences p WHERE p.tenant_id=t.tenant_id AND p.user_id=coalesce(t.assignee_id,$2::uuid) AND p.settings->>'reminders'='false') ON CONFLICT(dedupe_key) DO NOTHING`,
        [
          org.id,
          owner.id,
          settingsSchema.parse(org.settings).flow.reminderDays,
        ],
      );
      reminders += result.rowCount ?? 0;
      await db.query(
        "UPDATE organizations SET period_ends_at=now()+interval '1 month' WHERE id=$1 AND stripe_subscription_id IS NULL AND subscription_status='active' AND NOT cancel_at_period_end AND period_ends_at<=now()",
        [org.id],
      );
      await db.query(
        "UPDATE organizations SET subscription_status='canceled',cancel_at_period_end=false WHERE id=$1 AND stripe_subscription_id IS NULL AND cancel_at_period_end AND coalesce(period_ends_at,trial_ends_at)<=now()",
        [org.id],
      );
    }, org.id);
  await query("DELETE FROM sessions WHERE expires_at<now()");
  await query("DELETE FROM auth_tokens WHERE expires_at<now()");
  await query("DELETE FROM rate_limits WHERE expires_at<now()");
  return { runs, reminders };
}
