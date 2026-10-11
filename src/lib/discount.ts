import { rows, type DB } from "./db";
import { hash, type Context } from "./security";
export const CAMPAIGN_LOCK = 815410;
export async function campaignStatus(db: DB) {
  const [c] = await rows(
    db,
    `SELECT c.*,
    (SELECT count(*)::int FROM paying_customers WHERE launch_discount) AS redeemed,
    (SELECT count(*)::int FROM launch_reservations WHERE redeemed_at IS NULL AND expires_at>now()) AS reserved
    FROM launch_campaign c WHERE id=true`,
  );
  return {
    enabled: c.enabled,
    capacity: c.capacity,
    percent: c.percent,
    months: c.months,
    redeemed: c.redeemed,
    reserved: c.reserved,
    remaining: Math.max(0, c.capacity - c.redeemed - c.reserved),
    testMode: true,
  };
}
export function customerKey(ctx: Context) {
  return hash(`lyno-customer:${ctx.email.toLowerCase()}`);
}
export async function reserveDiscount(
  db: DB,
  ctx: Context,
  orderId: string,
  provider: string,
) {
  await db.query("SELECT pg_advisory_xact_lock($1)", [CAMPAIGN_LOCK]);
  const c = await campaignStatus(db);
  const key = customerKey(ctx);
  const [prior] = await rows(
    db,
    `SELECT 1 FROM paying_customers WHERE customer_key=$1 UNION ALL SELECT 1 FROM organizations WHERE id=$2 AND first_paid_at IS NOT NULL UNION ALL SELECT 1 FROM launch_reservations WHERE customer_key=$1 AND (redeemed_at IS NOT NULL OR expires_at>now())`,
    [key, ctx.tenantId],
  );
  if (prior || !c.enabled || c.remaining < 1) return null;
  // Stripe inventory is held until a signed payment/expiry event. Delayed webhooks must never oversell a slot.
  await db.query(
    `INSERT INTO launch_reservations(order_id,customer_key,tenant_id,expires_at,percent,months) VALUES($1,$2,$3,CASE WHEN $4='stripe_test' THEN 'infinity'::timestamptz ELSE now()+interval '30 minutes' END,$5,$6)`,
    [orderId, key, ctx.tenantId, provider, c.percent, c.months],
  );
  await db.query(
    "UPDATE checkout_orders SET discount_percent=$2,discount_months=$3 WHERE id=$1",
    [orderId, c.percent, c.months],
  );
  return c;
}
