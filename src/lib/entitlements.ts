import type { DB } from "./db";
import { rows } from "./db";
import { AppError } from "./security";
import { hasAccess } from "./access";
import { catalog, moduleIds, type ModuleId, type PlanId } from "./catalog";
export { hasAccess } from "./access";
export async function entitlements(db: DB, tenantId: string) {
  const [org] = await rows(db, "SELECT * FROM organizations WHERE id=$1", [
    tenantId,
  ]);
  if (!org) throw new AppError(404, "Firma nicht gefunden.");
  const plan = catalog().plans.find((p) => p.id === (org.plan as PlanId))!;
  return {
    plan,
    modules: (org.subscription_status === "trialing" &&
    hasAccess(org as Parameters<typeof hasAccess>[0])
      ? [...moduleIds]
      : org.modules) as ModuleId[],
    active: hasAccess(org as Parameters<typeof hasAccess>[0]),
  };
}
export async function requireEntitlement(
  db: DB,
  tenantId: string,
  module?: ModuleId,
  write = true,
) {
  const e = await entitlements(db, tenantId);
  if (module && !e.modules.includes(module))
    throw new AppError(
      402,
      `LYNO ${module.toUpperCase()} ist für diese Firma nicht gebucht.`,
    );
  if (write && !e.active)
    throw new AppError(
      402,
      "Ihre Testphase oder Ihr Abo ist beendet. Lesen und Export bleiben möglich. Aktivieren Sie in den Einstellungen ein Testabo.",
    );
  return e;
}
async function pendingLimit(
  db: DB,
  tenantId: string,
  key: "seats" | "automations",
  current: number,
) {
  const pending = await rows(
    db,
    "SELECT plan FROM checkout_orders WHERE tenant_id=$1 AND status='pending' AND (expires_at>now() OR provider='stripe_test')",
    [tenantId],
  );
  return Math.min(
    current,
    ...pending.map((o) => catalog().plans.find((p) => p.id === o.plan)![key]),
  );
}
export async function requireSeat(db: DB, tenantId: string) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    tenantId,
  ]);
  const { plan } = await entitlements(db, tenantId);
  const [n] = await rows(
    db,
    "SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1",
    [tenantId],
  );
  const limit = await pendingLimit(db, tenantId, "seats", plan.seats);
  if (n.n >= limit)
    throw new AppError(409, `Alle ${limit} Plätze des Pakets sind belegt.`);
}
export async function requireAutomation(db: DB, tenantId: string, id?: string) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    tenantId,
  ]);
  const { plan } = await requireEntitlement(db, tenantId, "flow");
  const [n] = await rows(
    db,
    "SELECT count(*)::int AS n FROM templates WHERE tenant_id=$1 AND recurrence_days IS NOT NULL AND active AND ($2::uuid IS NULL OR id<>$2)",
    [tenantId, id || null],
  );
  const limit = await pendingLimit(
    db,
    tenantId,
    "automations",
    plan.automations,
  );
  if (n.n >= limit)
    throw new AppError(
      409,
      `Das Limit von ${limit} aktiven Automationen ist erreicht.`,
    );
}
