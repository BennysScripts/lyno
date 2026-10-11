import { catalog } from "./catalog";
import { entitlements } from "./entitlements";
import {
  settingsSchema,
  preferencesSchema,
  loadPermissions,
  permitted,
} from "./customization";
import { readableDocuments, learningPaths } from "./learning";
import { campaignStatus } from "./discount";
import { rows, type DB } from "./db";
import { readableArticles } from "./academy";
import { insights } from "./insights";
import { plans } from "./billing";
import { canManage, uuid, type Context } from "./security";
export async function state(db: DB, ctx: Context, workflowId?: string) {
  const permissions = await loadPermissions(db, ctx);
  const access = await entitlements(db, ctx.tenantId);
  const flowAllowed =
    access.modules.includes("flow") && permitted(ctx, "flow.read");
  const academyAllowed =
    access.modules.includes("academy") && permitted(ctx, "academy.read");
  const selectedId = uuid.safeParse(workflowId).success ? workflowId : null;
  const [organization] = await rows(
    db,
    "SELECT id,name,industry,size,is_demo,plan,subscription_status,trial_ends_at,period_ends_at,cancel_at_period_end,modules,settings,discount_percent,discount_ends_at,created_at FROM organizations WHERE id=$1",
    [ctx.tenantId],
  );
  const organizations = await rows(
    db,
    "SELECT o.id,o.name,m.role FROM memberships m JOIN organizations o ON o.id=m.tenant_id WHERE m.user_id=$1 ORDER BY o.name",
    [ctx.userId],
  );
  const members = await rows(
    db,
    "SELECT u.id,u.name,u.email,m.role,m.custom_role_id,m.created_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 ORDER BY u.name",
    [ctx.tenantId],
  );
  const teams = await rows(
    db,
    "SELECT t.*,coalesce(array_agg(tm.user_id) FILTER(WHERE tm.user_id IS NOT NULL),ARRAY[]::uuid[]) AS user_ids FROM teams t LEFT JOIN team_members tm ON tm.tenant_id=t.tenant_id AND tm.team_id=t.id WHERE t.tenant_id=$1 GROUP BY t.id ORDER BY t.name",
    [ctx.tenantId],
  );
  const templates = await rows(
    db,
    "SELECT * FROM templates WHERE tenant_id=$1 ORDER BY created_at,name,id",
    [ctx.tenantId],
  );
  const workflows = await rows(
    db,
    "SELECT w.*,u.name AS creator_name FROM workflows w LEFT JOIN users u ON u.id=w.created_by WHERE w.tenant_id=$1 AND (w.status='active' OR w.id=$2 OR w.id IN (SELECT id FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100)) ORDER BY w.created_at DESC",
    [ctx.tenantId, selectedId],
  );
  const tasks = await rows(
    db,
    "SELECT * FROM tasks WHERE tenant_id=$1 AND workflow_id=ANY($2::uuid[]) ORDER BY position",
    [ctx.tenantId, workflows.map((w) => w.id)],
  );
  const comments = await rows(
    db,
    "SELECT c.*,u.name AS author_name FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.tenant_id=$1 AND c.workflow_id=ANY($2::uuid[]) ORDER BY c.created_at",
    [ctx.tenantId, workflows.map((w) => w.id)],
  );
  const articles = await readableArticles(db, ctx);
  const categories = await rows(
    db,
    "SELECT * FROM categories WHERE tenant_id=$1 ORDER BY name",
    [ctx.tenantId],
  );
  const checklist = await rows(
    db,
    "SELECT i.*,c.completed_at FROM checklist_items i LEFT JOIN checklist_completions c ON c.tenant_id=i.tenant_id AND c.item_id=i.id AND c.user_id=$2 WHERE i.tenant_id=$1 AND (i.article_id IS NULL OR i.article_id=ANY($3::uuid[])) ORDER BY i.title",
    [ctx.tenantId, ctx.userId, articles.map((a) => a.id)],
  );
  const notifications = await rows(
    db,
    "SELECT * FROM notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100",
    [ctx.tenantId, ctx.userId],
  );
  const activity = selectedId
    ? await rows(
        db,
        "SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.tenant_id=$1 AND a.entity_id=$2 AND ($3 OR a.action LIKE 'task.%' OR a.action='workflow.started' OR a.action='comment.created') ORDER BY a.created_at DESC",
        [ctx.tenantId, selectedId, canManage(ctx.role)],
      )
    : await rows(
        db,
        canManage(ctx.role)
          ? "SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.tenant_id=$1 ORDER BY a.created_at DESC LIMIT 100"
          : "SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.tenant_id=$1 AND a.action LIKE 'task.%' ORDER BY a.created_at DESC LIMIT 50",
        [ctx.tenantId],
      );
  const invitations = ["owner", "admin"].includes(ctx.role)
    ? await rows(
        db,
        "SELECT id,email,role,expires_at,accepted_at FROM invitations WHERE tenant_id=$1 ORDER BY created_at DESC",
        [ctx.tenantId],
      )
    : [];
  const billing =
    ctx.role === "owner"
      ? await rows(
          db,
          "SELECT * FROM billing_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50",
          [ctx.tenantId],
        )
      : [];
  const [usage] = await rows(
    db,
    "SELECT count FROM assist_usage WHERE tenant_id=$1 AND day=current_date",
    [ctx.tenantId],
  );
  const settings = settingsSchema.parse(organization.settings);
  const [pref] = await rows(
    db,
    "SELECT settings FROM user_preferences WHERE tenant_id=$1 AND user_id=$2",
    [ctx.tenantId, ctx.userId],
  );
  const insightsAllowed =
    access.modules.includes("insights") && permitted(ctx, "insights.read");
  const report =
    flowAllowed || insightsAllowed
      ? await insights(db, ctx, settings.insights.days)
      : {
          summary: {
            total: 0,
            active: 0,
            completed: 0,
            canceled: 0,
            avg_hours: null,
            overdue: 0,
          },
          weekly: [],
          bottlenecks: [],
          processes: [],
          days: settings.insights.days,
        };
  if (!insightsAllowed) {
    report.weekly = [];
    report.bottlenecks = [];
    report.processes = [];
  }
  return {
    permissions,
    settings,
    preferences: preferencesSchema.parse(pref?.settings || {}),
    access,
    catalog: catalog(),
    campaign: await campaignStatus(db),
    customRoles: await rows(
      db,
      "SELECT * FROM custom_roles WHERE tenant_id=$1 ORDER BY name",
      [ctx.tenantId],
    ),
    orders:
      ctx.role === "owner"
        ? await rows(
            db,
            "SELECT id,plan,modules,amount_cents,discount_percent,discount_months,checkout_url,status,provider,expires_at,created_at FROM checkout_orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 30",
            [ctx.tenantId],
          )
        : [],
    documents: academyAllowed ? await readableDocuments(db, ctx) : [],
    learningPaths: academyAllowed ? await learningPaths(db, ctx) : [],
    now: new Date().toISOString(),
    mailMode: process.env.MAIL_MODE === "smtp" ? "smtp" : "local",
    me: {
      id: ctx.userId,
      name: ctx.name,
      email: ctx.email,
      role: ctx.role,
      verified: ctx.verified,
    },
    organization,
    organizations,
    members,
    teams,
    templates: flowAllowed ? templates : [],
    workflows: flowAllowed ? workflows : [],
    tasks: flowAllowed ? tasks : [],
    comments: flowAllowed ? comments : [],
    articles: academyAllowed ? articles : [],
    categories: academyAllowed ? categories : [],
    checklist: academyAllowed ? checklist : [],
    notifications,
    activity,
    invitations,
    billing,
    plans: plans(),
    insights: report,
    assist: {
      testMode: process.env.ASSIST_MODE !== "openai",
      used: usage?.count ?? 0,
      limit: Math.min(access.plan.aiDaily, settings.assist.dailyLimit),
    },
    billingProvider: process.env.STRIPE_SECRET_KEY
      ? "stripe-test"
      : "local-test",
  };
}
export async function exportData(db: DB, ctx: Context) {
  const output: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
  };
  // Fixed table names are never derived from request input.
  for (const table of [
    "memberships",
    "teams",
    "team_members",
    "templates",
    "workflows",
    "tasks",
    "comments",
    "articles",
    "categories",
    "checklist_items",
    "checklist_completions",
    "audit_logs",
    "billing_events",
    "documents",
    "learning_paths",
    "learning_progress",
    "custom_roles",
    "user_preferences",
    "checkout_orders",
  ])
    output[table] = await rows(
      db,
      `SELECT * FROM ${table} WHERE tenant_id=$1`,
      [ctx.tenantId],
    );
  output.organization = (
    await rows(
      db,
      "SELECT id,name,industry,size,plan,modules,settings,subscription_status,created_at FROM organizations WHERE id=$1",
      [ctx.tenantId],
    )
  )[0];
  return output;
}
