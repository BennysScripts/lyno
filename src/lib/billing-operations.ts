import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction, query, rows, type DB } from "./db";
import { AppError, uuid } from "./security";
import { settle, stripe } from "./billing";

const retryWindowMs = 22 * 3600 * 1000;
const checkoutPayload = z.object({
  orderId: uuid,
  productName: z.string(),
  customerId: z.string().nullable(),
  customerEmail: z.string().email(),
  subscriptionId: z.string().nullable(),
  discountPercent: z.number().int().min(0).max(90),
  discountMonths: z.number().int().min(0).max(24),
  checkoutExpiresAt: z.number().int(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
async function notify(db: DB, tenantId: string, key: string, title: string) {
  await db.query(
    `INSERT INTO notifications(tenant_id,user_id,title,href,dedupe_key)
     SELECT tenant_id,user_id,$3,'/app/settings?tab=billing',$2||':'||user_id FROM memberships
     WHERE tenant_id=$1 AND role='owner' ON CONFLICT(dedupe_key) DO NOTHING`,
    [tenantId, `${key}:${tenantId}`, title],
  );
}
async function closeOrder(
  db: DB,
  tenantId: string,
  orderId: string,
  status: "expired" | "canceled",
) {
  await db.query(
    "UPDATE checkout_orders SET status=$3 WHERE tenant_id=$1 AND id=$2 AND status='pending'",
    [tenantId, orderId, status],
  );
  await db.query(
    "UPDATE launch_reservations SET expires_at=now() WHERE tenant_id=$1 AND order_id=$2 AND redeemed_at IS NULL",
    [tenantId, orderId],
  );
}

// Called only after the request transaction has committed its immutable intent
// and inventory reservation. Failed provider calls cannot erase that intent.
export async function processBillingOperation(
  tenantId: string,
  id: string,
  force = false,
) {
  uuid.parse(tenantId);
  uuid.parse(id);
  const api = stripe();
  if (!api) throw new AppError(503, "Stripe-Testzugang nicht eingerichtet.");
  const lease = randomUUID();
  const claimed = await transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      tenantId,
    ]);
    const [op] = await rows(
      db,
      "SELECT * FROM billing_operations WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [tenantId, id],
    );
    if (!op) throw new AppError(404, "Abrechnungsauftrag nicht gefunden.");
    if (op.status === "succeeded") return false;
    if (Date.now() - new Date(op.created_at).getTime() >= retryWindowMs) {
      await db.query(
        "UPDATE billing_operations SET status='attention',last_error_code='retry_window_expired',lease_token=NULL,lease_until=NULL WHERE id=$1",
        [id],
      );
      await notify(
        db,
        tenantId,
        `billing:${id}`,
        "Abrechnung benötigt eine Prüfung: Wiederholungsfenster abgelaufen.",
      );
      return false;
    }
    if (op.status === "processing" && new Date(op.lease_until) > new Date())
      return false;
    if (
      !force &&
      (op.status === "attention" || new Date(op.next_attempt_at) > new Date())
    )
      return false;
    await db.query(
      "UPDATE billing_operations SET status='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '3 minutes',last_error_code=NULL WHERE id=$1",
      [id, lease],
    );
    return true;
  }, tenantId);
  if (claimed) {
    try {
      await transaction(async (db) => {
        await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
          tenantId,
        ]);
        const [op] = await rows(
          db,
          "SELECT * FROM billing_operations WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 FOR UPDATE",
          [tenantId, id, lease],
        );
        if (!op || op.status !== "processing") return;
        if (op.action === "subscribe") {
          const p = checkoutPayload.parse(op.payload);
          const [order] = await rows(
            db,
            "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [tenantId, p.orderId],
          );
          if (!order || order.provider !== "stripe_test")
            throw new AppError(409, "Bestellung ist nicht verfügbar.");
          if (order.status !== "pending")
            throw new AppError(409, "Bestellung ist nicht mehr offen.");
          const product = await api.products.create(
            { name: p.productName, metadata: { tenantId, orderId: order.id } },
            { idempotencyKey: `lyno-product-${order.id}` },
          );
          const price = await api.prices.create(
            {
              product: product.id,
              currency: "eur",
              unit_amount: order.amount_cents,
              recurring: { interval: "month" },
              metadata: { tenantId, orderId: order.id },
            },
            { idempotencyKey: `lyno-price-${order.id}` },
          );
          await db.query(
            "UPDATE checkout_orders SET stripe_price_id=$2 WHERE id=$1",
            [order.id, price.id],
          );
          if (p.subscriptionId) {
            const previous = await api.subscriptions.retrieve(p.subscriptionId);
            if (previous.livemode || !previous.items.data[0])
              throw new AppError(409, "Testabo nicht verfügbar.");
            const updated = await api.subscriptions.update(
              previous.id,
              {
                items: [{ id: previous.items.data[0].id, price: price.id }],
                payment_behavior: "pending_if_incomplete",
                proration_behavior: "always_invoice",
                expand: ["latest_invoice"],
              },
              { idempotencyKey: `lyno-change-${order.id}` },
            );
            const invoice = updated.latest_invoice;
            if (!invoice || typeof invoice === "string")
              throw new AppError(
                409,
                "Änderungsrechnung noch nicht verfügbar.",
              );
            await db.query(
              "UPDATE checkout_orders SET stripe_subscription_id=$2,stripe_invoice_id=$3,checkout_url=$4 WHERE id=$1",
              [order.id, previous.id, invoice.id, invoice.hosted_invoice_url],
            );
          } else {
            const coupon =
              p.discountPercent > 0
                ? await api.coupons.create(
                    {
                      percent_off: p.discountPercent,
                      duration: "repeating",
                      duration_in_months: p.discountMonths,
                      name: `LYNO Start: ${p.discountPercent}% für ${p.discountMonths} Monate`,
                    },
                    { idempotencyKey: `lyno-coupon-${order.id}` },
                  )
                : null;
            const session = await api.checkout.sessions.create(
              {
                mode: "subscription",
                customer: p.customerId || undefined,
                customer_email: p.customerId ? undefined : p.customerEmail,
                line_items: [{ price: price.id, quantity: 1 }],
                discounts: coupon ? [{ coupon: coupon.id }] : undefined,
                metadata: { tenantId, orderId: order.id },
                subscription_data: {
                  metadata: { tenantId, orderId: order.id },
                },
                client_reference_id: tenantId,
                expires_at: p.checkoutExpiresAt,
                success_url: p.successUrl,
                cancel_url: p.cancelUrl,
              },
              { idempotencyKey: `lyno-checkout-${order.id}` },
            );
            if (session.livemode)
              throw new AppError(409, "Live-Checkout ist nicht erlaubt.");
            await db.query(
              "UPDATE checkout_orders SET stripe_session_id=$2,checkout_url=$3 WHERE id=$1",
              [order.id, session.id, session.url],
            );
          }
        } else if (op.action === "abandon") {
          const { orderId } = z.object({ orderId: uuid }).parse(op.payload);
          const [order] = await rows(
            db,
            "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [tenantId, orderId],
          );
          if (!order) throw new AppError(404, "Bestellung nicht gefunden.");
          if (order.status === "pending") {
            if (order.stripe_session_id) {
              const session = await api.checkout.sessions.retrieve(
                order.stripe_session_id,
              );
              if (session.livemode || session.status === "complete")
                throw new AppError(409, "Zahlung bitte zuerst abgleichen.");
              if (session.status !== "expired")
                await api.checkout.sessions.expire(
                  session.id,
                  {},
                  { idempotencyKey: `lyno-abandon-${id}` },
                );
            } else if (order.stripe_invoice_id) {
              const invoice = await api.invoices.retrieve(
                order.stripe_invoice_id,
              );
              if (invoice.livemode || invoice.status === "paid")
                throw new AppError(409, "Rechnung bitte zuerst abgleichen.");
              if (invoice.status !== "void")
                await api.invoices.voidInvoice(
                  invoice.id,
                  {},
                  { idempotencyKey: `lyno-abandon-${id}` },
                );
            } else throw new AppError(409, "Providerstatus ist noch unklar.");
            await closeOrder(db, tenantId, order.id, "canceled");
          }
        } else {
          const { subscriptionId } = z
            .object({ subscriptionId: z.string().min(1) })
            .parse(op.payload);
          const s = await api.subscriptions.update(
            subscriptionId,
            { cancel_at_period_end: op.action === "cancel" },
            { idempotencyKey: `lyno-${op.action}-${id}` },
          );
          if (s.livemode)
            throw new AppError(409, "Live-Abo ist nicht erlaubt.");
          await db.query(
            "UPDATE organizations SET cancel_at_period_end=$2 WHERE id=$1 AND stripe_subscription_id=$3",
            [tenantId, op.action === "cancel", subscriptionId],
          );
        }
        await db.query(
          "UPDATE billing_operations SET status='succeeded',completed_at=now(),lease_until=NULL,lease_token=NULL,last_error_code=NULL WHERE id=$1",
          [id],
        );
        await db.query(
          "INSERT INTO audit_logs(tenant_id,actor_id,action,entity_id) VALUES($1,$2,'billing.operation_completed',$3)",
          [tenantId, op.requested_by, id],
        );
      }, tenantId);
    } catch {
      await transaction(async (db) => {
        await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
          tenantId,
        ]);
        const [op] = await rows(
          db,
          "UPDATE billing_operations SET status=CASE WHEN attempts>=8 THEN 'attention' ELSE 'pending' END,last_error_code='provider_unavailable',lease_token=NULL,lease_until=NULL,next_attempt_at=now()+least(3600,power(2,least(attempts,10))*30)*interval '1 second' WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND status='processing' RETURNING status",
          [tenantId, id, lease],
        );
        if (op?.status === "attention")
          await notify(
            db,
            tenantId,
            `billing:${id}`,
            "Abrechnungsauftrag wartet auf Prüfung. Bestehende Rechte bleiben erhalten.",
          );
      }, tenantId);
    }
  }
  return transaction(async (db) => {
    const [op] = await rows(
      db,
      "SELECT b.status,b.action,b.payload->>'orderId' AS order_id,o.checkout_url FROM billing_operations b LEFT JOIN checkout_orders o ON o.tenant_id=b.tenant_id AND o.id::text=b.payload->>'orderId' WHERE b.tenant_id=$1 AND b.id=$2",
      [tenantId, id],
    );
    return {
      billingOperationId: id,
      orderId: op?.order_id as string | undefined,
      url:
        op?.status === "succeeded" && op.action === "subscribe"
          ? (op.checkout_url as string | null)
          : null,
      message:
        op?.status === "succeeded"
          ? op.action === "subscribe"
            ? "Stripe-Testcheckout bereit. Freischaltung erfolgt nach bestätigter Zahlung."
            : "Abrechnungsauftrag verarbeitet."
          : op?.status === "attention"
            ? "Der gespeicherte Auftrag benötigt eine Prüfung. Es wurde keine neue Bestellung erzeugt."
            : "Auftrag gespeichert. Der Hintergrunddienst wiederholt die Verarbeitung; Sie können den Status erneut prüfen.",
    };
  }, tenantId);
}

export async function reconcileStripeTenant(tenantId: string) {
  const api = stripe();
  if (!api) return { checked: false };
  try {
    await transaction(async (db) => {
      const [org] = await rows(
        db,
        "SELECT * FROM organizations WHERE id=$1 FOR UPDATE",
        [tenantId],
      );
      if (!org) return;
      const orders = await rows(
        db,
        "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND provider='stripe_test' AND status='pending' ORDER BY created_at LIMIT 20 FOR UPDATE",
        [tenantId],
      );
      for (const order of orders) {
        if (order.stripe_session_id) {
          const s = await api.checkout.sessions.retrieve(
            order.stripe_session_id,
          );
          if (
            s.livemode ||
            s.id !== order.stripe_session_id ||
            s.metadata?.tenantId !== tenantId ||
            s.metadata?.orderId !== order.id
          )
            throw new AppError(409, "Checkout-Zuordnung ungültig.");
          if (s.status === "expired")
            await closeOrder(db, tenantId, order.id, "expired");
          else if (
            s.mode === "subscription" &&
            s.payment_status === "paid" &&
            s.subscription
          ) {
            const sub = await api.subscriptions.retrieve(
              typeof s.subscription === "string"
                ? s.subscription
                : s.subscription.id,
            );
            if (
              sub.livemode ||
              sub.status !== "active" ||
              !sub.items.data.some((i) => i.price.id === order.stripe_price_id)
            )
              throw new AppError(
                409,
                "Zahlungsbestätigung noch nicht vollständig.",
              );
            await settle(
              db,
              order.id,
              `checkout:${s.id}`,
              sub.items.data[0]?.current_period_end,
              s.amount_total ?? undefined,
            );
            await db.query(
              "UPDATE organizations SET stripe_customer_id=$2,stripe_subscription_id=$3,cancel_at_period_end=$4 WHERE id=$1",
              [
                tenantId,
                typeof s.customer === "string" ? s.customer : s.customer?.id,
                sub.id,
                sub.cancel_at_period_end,
              ],
            );
          }
        } else if (order.stripe_invoice_id && order.stripe_subscription_id) {
          const invoice = await api.invoices.retrieve(order.stripe_invoice_id);
          if (invoice.livemode)
            throw new AppError(409, "Live-Rechnung ist nicht erlaubt.");
          if (invoice.status === "void")
            await closeOrder(db, tenantId, order.id, "canceled");
          else if (invoice.status === "paid") {
            const sub = await api.subscriptions.retrieve(
              order.stripe_subscription_id,
            );
            if (
              sub.status === "active" &&
              !sub.livemode &&
              !sub.pending_update &&
              sub.items.data.some((i) => i.price.id === order.stripe_price_id)
            )
              await settle(
                db,
                order.id,
                `invoice:${invoice.id}`,
                sub.items.data[0]?.current_period_end,
                invoice.amount_paid,
              );
          }
        }
      }
      const [currentOrg] = await rows(
        db,
        "SELECT * FROM organizations WHERE id=$1",
        [tenantId],
      );
      if (currentOrg.stripe_subscription_id) {
        const sub = await api.subscriptions.retrieve(
          currentOrg.stripe_subscription_id,
          { expand: ["latest_invoice"] },
        );
        if (sub.livemode)
          throw new AppError(409, "Live-Abo ist nicht erlaubt.");
        const latest =
          typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
        const [paid] = await rows(
          db,
          "SELECT stripe_price_id FROM checkout_orders WHERE tenant_id=$1 AND status='paid' AND provider='stripe_test' ORDER BY paid_at DESC LIMIT 1",
          [tenantId],
        );
        const paidActive =
          sub.status === "active" &&
          latest?.status === "paid" &&
          !latest.livemode &&
          paid &&
          sub.items.data.some((i) => i.price.id === paid.stripe_price_id);
        const status =
          sub.status === "canceled"
            ? "canceled"
            : [
                  "past_due",
                  "unpaid",
                  "incomplete",
                  "incomplete_expired",
                ].includes(sub.status)
              ? "past_due"
              : paidActive
                ? "active"
                : currentOrg.subscription_status;
        await db.query(
          "UPDATE organizations SET subscription_status=$2,cancel_at_period_end=$3,period_ends_at=CASE WHEN $4 THEN to_timestamp($5) ELSE period_ends_at END,stripe_event_at=greatest(stripe_event_at,extract(epoch FROM now())::bigint) WHERE id=$1",
          [
            tenantId,
            status,
            sub.cancel_at_period_end,
            !!paidActive,
            sub.items.data[0]?.current_period_end || null,
          ],
        );
        if (paidActive && latest?.billing_reason === "subscription_cycle")
          await db.query(
            "INSERT INTO billing_events(tenant_id,event_key,kind,plan,amount_cents) VALUES($1,$2,'stripe_test_renewal',$3,$4) ON CONFLICT(event_key) DO NOTHING",
            [
              tenantId,
              `invoice:${latest.id}`,
              currentOrg.plan,
              latest.amount_paid,
            ],
          );
      }
      // Complete stale abandonment intents after an authoritative payment/expiry check.
      await db.query(
        "UPDATE billing_operations b SET status='succeeded',completed_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=NULL FROM checkout_orders o WHERE b.tenant_id=$1 AND o.tenant_id=b.tenant_id AND o.id::text=b.payload->>'orderId' AND o.status<>'pending' AND b.action IN ('subscribe','abandon') AND b.status<>'succeeded'",
        [tenantId],
      );
      await db.query(
        "UPDATE organizations SET billing_checked_at=now(),billing_check_error=NULL WHERE id=$1",
        [tenantId],
      );
    }, tenantId);
    return { checked: true };
  } catch {
    await transaction(async (db) => {
      await db.query(
        "UPDATE organizations SET billing_check_error='provider_check_failed' WHERE id=$1",
        [tenantId],
      );
      await notify(
        db,
        tenantId,
        `billing-check:${new Date().toISOString().slice(0, 10)}`,
        "Zahlungsabgleich derzeit nicht möglich. Bitte Abrechnungsstatus prüfen.",
      );
    }, tenantId);
    return { checked: false };
  }
}

export async function runBillingJobs(tenantIds?: string[]) {
  if (!stripe()) return { processed: 0, checked: 0 };
  const orgs = await query(
    "SELECT id FROM organizations WHERE ($1::uuid[] IS NULL OR id=ANY($1))",
    [tenantIds ?? null],
  );
  let processed = 0,
    checked = 0;
  for (const org of orgs) {
    const operations = await transaction(
      (db) =>
        rows(
          db,
          "SELECT id FROM billing_operations WHERE tenant_id=$1 AND status IN ('pending','processing') AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at LIMIT 1",
          [org.id],
        ),
      org.id,
    );
    for (const op of operations) {
      await processBillingOperation(org.id, op.id);
      processed++;
    }
    if ((await reconcileStripeTenant(org.id)).checked) checked++;
  }
  return { processed, checked };
}
