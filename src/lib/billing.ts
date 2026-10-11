import Stripe from "stripe";
import { z } from "zod";
import { rows, query, transaction, type DB } from "./db";
import {
  AppError,
  audit,
  appUrl,
  requireRole,
  uuid,
  hash,
  type Context,
} from "./security";
import { catalog, quote, selectionSchema } from "./catalog";
import { CAMPAIGN_LOCK, customerKey, reserveDiscount } from "./discount";
export function plans() {
  return catalog().plans;
}
function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_"))
    throw new AppError(503, "Nur Stripe-Testschlüssel sind zulässig.");
  return new Stripe(key, { timeout: 15000, maxNetworkRetries: 1 });
}
async function validateLimits(db: DB, tenantId: string, selection: unknown) {
  const q = quote(selection);
  const [n] = await rows(
    db,
    `SELECT (SELECT count(*)::int FROM memberships WHERE tenant_id=$1) AS members,(SELECT count(*)::int FROM templates WHERE tenant_id=$1 AND recurrence_days IS NOT NULL AND active) AS automations`,
    [tenantId],
  );
  if (n.members > q.limits.seats || n.automations > q.limits.automations)
    throw new AppError(
      409,
      "Das Paket reicht für die aktuellen Nutzer oder aktiven Automationen nicht aus. Passen Sie diese zuerst an.",
    );
  return q;
}
async function settle(
  db: DB,
  orderId: string,
  eventKey: string,
  periodEnd?: number,
  amountPaid?: number,
) {
  const [order] = await rows(
    db,
    "SELECT * FROM checkout_orders WHERE id=$1 FOR UPDATE",
    [orderId],
  );
  if (!order) throw new AppError(404, "Bestellung nicht gefunden.");
  if (order.status === "paid") return;
  if (order.status !== "pending")
    throw new AppError(409, "Die Bestellung ist nicht mehr offen.");
  if (
    order.provider === "local_test" &&
    new Date(order.expires_at).getTime() <= Date.now()
  )
    throw new AppError(
      409,
      "Die Reservierung ist abgelaufen. Bitte erstellen Sie einen neuen Checkout.",
    );
  await validateLimits(db, order.tenant_id, {
    plan: order.plan,
    modules: order.modules,
  });
  await db.query("SELECT pg_advisory_xact_lock($1)", [CAMPAIGN_LOCK]);
  const [reservation] = await rows(
    db,
    "SELECT * FROM launch_reservations WHERE order_id=$1 AND redeemed_at IS NULL AND expires_at>now()",
    [orderId],
  );
  const [existing] = await rows(
    db,
    "SELECT discount_percent,discount_ends_at FROM organizations WHERE id=$1",
    [order.tenant_id],
  );
  const retainedDiscount =
    existing.discount_percent === order.discount_percent &&
    existing.discount_ends_at &&
    new Date(existing.discount_ends_at) > new Date(order.created_at);
  if (order.discount_percent > 0 && !reservation && !retainedDiscount)
    throw new AppError(409, "Rabattreservierung ist abgelaufen.");
  await db.query(
    `INSERT INTO paying_customers(customer_key,launch_discount) VALUES($1,$2) ON CONFLICT(customer_key) DO UPDATE SET launch_discount=paying_customers.launch_discount OR excluded.launch_discount`,
    [order.customer_key, !!reservation],
  );
  if (reservation)
    await db.query(
      "UPDATE launch_reservations SET redeemed_at=now() WHERE order_id=$1",
      [orderId],
    );
  await db.query(
    `UPDATE organizations SET plan=$2,modules=$3,subscription_status='active',period_ends_at=coalesce(to_timestamp($4),now()+interval '1 month'),cancel_at_period_end=false,first_paid_at=coalesce(first_paid_at,now()),discount_percent=CASE WHEN $5>0 THEN $5 ELSE discount_percent END,discount_ends_at=CASE WHEN $5>0 THEN now()+$6*interval '1 month' ELSE discount_ends_at END WHERE id=$1`,
    [
      order.tenant_id,
      order.plan,
      order.modules,
      periodEnd || null,
      reservation ? order.discount_percent : 0,
      reservation?.months || 0,
    ],
  );
  await db.query(
    "UPDATE checkout_orders SET status='paid',paid_at=now() WHERE id=$1",
    [orderId],
  );
  await db.query(
    `INSERT INTO billing_events(tenant_id,event_key,kind,plan,amount_cents) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_key) DO NOTHING`,
    [
      order.tenant_id,
      eventKey,
      `${order.provider}_subscription`,
      order.plan,
      amountPaid ??
        Math.round(order.amount_cents * (1 - order.discount_percent / 100)),
    ],
  );
}
export async function subscription(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner"]);
  const d = z
    .object({
      action: z.enum([
        "subscribe",
        "confirm",
        "cancel",
        "resume",
        "portal",
        "abandon",
      ]),
      plan: selectionSchema.shape.plan.optional(),
      modules: selectionSchema.shape.modules.optional(),
      orderId: uuid.optional(),
    })
    .parse(input);
  const [org] = await rows(
    db,
    "SELECT * FROM organizations WHERE id=$1 FOR UPDATE",
    [ctx.tenantId],
  );
  const api = stripe();
  if (d.action === "portal") {
    if (!api || !org.stripe_customer_id)
      throw new AppError(
        409,
        "Für dieses lokale Testabo gibt es kein Stripe-Kundenportal. Die Aboverwaltung erfolgt hier.",
      );
    const configuration = await api.billingPortal.configurations.create(
      {
        features: {
          customer_update: { enabled: false },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
          subscription_update: { enabled: false },
        },
      },
      { idempotencyKey: "lyno-portal-test-v1" },
    );
    const portal = await api.billingPortal.sessions.create({
      configuration: configuration.id,
      customer: org.stripe_customer_id,
      return_url: `${appUrl()}/app/settings`,
    });
    return { url: portal.url, message: "Stripe-Testportal geöffnet." };
  }
  if (d.action === "confirm" || d.action === "abandon") {
    const [order] = await rows(
      db,
      "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [ctx.tenantId, d.orderId || null],
    );
    if (!order) throw new AppError(404, "Bestellung nicht gefunden.");
    if (d.action === "confirm") {
      if (api || order.provider !== "local_test")
        throw new AppError(
          403,
          "Stripe-Zahlungen können nur durch einen signierten Zahlungswebhook bestätigt werden.",
        );
      if (!ctx.verified)
        throw new AppError(403, "Bitte bestätigen Sie Ihre E-Mail-Adresse.");
      await settle(db, order.id, `local:${order.id}`);
      await audit(db, ctx, "billing.test_payment_confirmed", order.id);
      return {
        message:
          "Testzahlung bestätigt. Paket und Module sind jetzt aktiv. Es wurde kein Geld eingezogen.",
      };
    }
    if (order.status === "pending") {
      if (api && order.stripe_session_id)
        await api.checkout.sessions.expire(order.stripe_session_id);
      if (api && order.stripe_invoice_id)
        await api.invoices.voidInvoice(order.stripe_invoice_id);
      await db.query(
        "UPDATE checkout_orders SET status='canceled' WHERE id=$1",
        [order.id],
      );
      await db.query(
        "UPDATE launch_reservations SET expires_at=now() WHERE order_id=$1 AND redeemed_at IS NULL",
        [order.id],
      );
    }
    return { message: "Offene Bestellung verworfen." };
  }
  if (d.action === "subscribe") {
    if (!ctx.verified)
      throw new AppError(
        403,
        "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
      );
    if (!d.plan) throw new AppError(400, "Bitte wählen Sie ein Paket.");
    const q = await validateLimits(db, ctx.tenantId, {
      plan: d.plan,
      modules: d.modules,
    });
    const [open] = await rows(
      db,
      "SELECT id FROM checkout_orders WHERE tenant_id=$1 AND status='pending' AND (expires_at>now() OR provider='stripe_test')",
      [ctx.tenantId],
    );
    if (open)
      throw new AppError(
        409,
        "Es gibt bereits eine offene Bestellung. Bestätigen oder verwerfen Sie diese zuerst.",
      );
    const [order] = await rows(
      db,
      `INSERT INTO checkout_orders(tenant_id,plan,modules,amount_cents,provider,customer_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        ctx.tenantId,
        q.plan,
        q.modules,
        q.amountCents,
        api ? "stripe_test" : "local_test",
        customerKey(ctx),
      ],
    );
    if (
      org.discount_percent > 0 &&
      org.discount_ends_at &&
      new Date(org.discount_ends_at) > new Date()
    )
      await db.query(
        "UPDATE checkout_orders SET discount_percent=$2 WHERE id=$1",
        [order.id, org.discount_percent],
      );
    const discount = await reserveDiscount(db, ctx, order.id, order.provider);
    if (api) {
      const product = await api.products.create(
        {
          name: `LYNO ${q.limits.name} · CORE${q.modules.length ? " + " + q.modules.join(", ").toUpperCase() : ""}`,
          metadata: { selection: hash(JSON.stringify(q.modules)) },
        },
        { idempotencyKey: `lyno-product-${order.id}` },
      );
      const price = await api.prices.create(
        {
          product: product.id,
          currency: "eur",
          unit_amount: q.amountCents,
          recurring: { interval: "month" },
        },
        { idempotencyKey: `lyno-price-${order.id}` },
      );
      await db.query(
        "UPDATE checkout_orders SET stripe_price_id=$2 WHERE id=$1",
        [order.id, price.id],
      );
      const coupon = discount
        ? await api.coupons.create(
            {
              percent_off: discount.percent,
              duration: "repeating",
              duration_in_months: discount.months,
              name: `LYNO Start: ${discount.percent}% für ${discount.months} Monate`,
            },
            { idempotencyKey: `lyno-coupon-${order.id}` },
          )
        : null;
      if (
        org.stripe_subscription_id &&
        org.subscription_status !== "canceled"
      ) {
        const previous = await api.subscriptions.retrieve(
          org.stripe_subscription_id,
        );
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
        const invoice = updated.latest_invoice as Stripe.Invoice;
        await db.query(
          "UPDATE checkout_orders SET stripe_subscription_id=$2,stripe_invoice_id=$3,checkout_url=$4 WHERE id=$1",
          [order.id, previous.id, invoice.id, invoice.hosted_invoice_url],
        );
        return {
          orderId: order.id,
          url: invoice.hosted_invoice_url,
          message:
            "Tarifwechsel bei Stripe im Testmodus vorbereitet. Freischaltung erfolgt nach bestätigter Rechnung; Stripe verrechnet die Restlaufzeit.",
        };
      }
      const session = await api.checkout.sessions.create(
        {
          mode: "subscription",
          customer: org.stripe_customer_id || undefined,
          customer_email: org.stripe_customer_id ? undefined : ctx.email,
          line_items: [{ price: price.id, quantity: 1 }],
          discounts: coupon ? [{ coupon: coupon.id }] : undefined,
          metadata: { tenantId: ctx.tenantId, orderId: order.id },
          subscription_data: {
            metadata: { tenantId: ctx.tenantId, orderId: order.id },
          },
          client_reference_id: ctx.tenantId,
          expires_at: Math.floor(Date.now() / 1000) + 1800,
          success_url: `${appUrl()}/app/settings?checkout=success`,
          cancel_url: `${appUrl()}/app/settings?checkout=canceled`,
        },
        { idempotencyKey: `lyno-checkout-${order.id}` },
      );
      await db.query(
        "UPDATE checkout_orders SET stripe_session_id=$2,checkout_url=$3 WHERE id=$1",
        [order.id, session.id, session.url],
      );
      return {
        orderId: order.id,
        url: session.url,
        message:
          "Stripe-Testcheckout bereit. Rechte werden nach Zahlungsbestätigung aktiviert.",
      };
    }
    await audit(db, ctx, "billing.test_checkout_created", order.id, {
      plan: q.plan,
      modules: q.modules,
    });
    return {
      orderId: order.id,
      message:
        "Bestellung vorbereitet. Bitte bestätigen Sie die simulierte Testzahlung im Checkout.",
    };
  }
  if (!["active", "trialing"].includes(org.subscription_status))
    throw new AppError(409, "Es gibt kein aktives Abo.");
  if (api && org.stripe_subscription_id)
    await api.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: d.action === "cancel",
    });
  await db.query(
    "UPDATE organizations SET cancel_at_period_end=$2 WHERE id=$1",
    [ctx.tenantId, d.action === "cancel"],
  );
  await audit(db, ctx, `billing.test_${d.action}`, ctx.tenantId);
  return {
    message:
      d.action === "cancel"
        ? "Kündigung zum Ende der Laufzeit vorgemerkt."
        : "Kündigung zurückgenommen.",
  };
}
export async function stripeWebhook(body: string, signature: string) {
  const api = stripe();
  if (!api || !process.env.STRIPE_WEBHOOK_SECRET)
    throw new AppError(503, "Stripe-Testwebhook nicht eingerichtet.");
  let event: Stripe.Event;
  try {
    event = api.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Ungültige Signatur.");
  }
  if (event.livemode)
    throw new AppError(400, "Live-Ereignisse sind nicht erlaubt.");
  const obj = event.data.object;
  let tenantId: string | undefined;
  if (event.type.startsWith("checkout.session."))
    tenantId = (obj as Stripe.Checkout.Session).metadata?.tenantId;
  else if (event.type.startsWith("customer.subscription."))
    tenantId = (
      await query(
        "SELECT id FROM organizations WHERE stripe_subscription_id=$1",
        [(obj as Stripe.Subscription).id],
      )
    )[0]?.id;
  else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = obj as Stripe.Invoice;
    const sub = invoice.parent?.subscription_details?.subscription;
    tenantId = (
      await query(
        "SELECT id FROM organizations WHERE stripe_subscription_id=$1",
        [typeof sub === "string" ? sub : sub?.id],
      )
    )[0]?.id;
  }
  if (!tenantId) return { received: true };
  uuid.parse(tenantId);
  return transaction(async (db) => {
    const [org] = await rows(
      db,
      "SELECT * FROM organizations WHERE id=$1 FOR UPDATE",
      [tenantId],
    );
    if (!org) return { received: true };
    const inserted = await db.query(
      "INSERT INTO webhook_events(id) VALUES($1) ON CONFLICT DO NOTHING",
      [event.id],
    );
    if (!inserted.rowCount) return { received: true };
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.expired",
      ].includes(event.type)
    ) {
      const s = obj as Stripe.Checkout.Session;
      const [order] = await rows(
        db,
        "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND id=$2 AND stripe_session_id=$3 FOR UPDATE",
        [tenantId, uuid.parse(s.metadata?.orderId), s.id],
      );
      if (!order)
        throw new AppError(
          400,
          "Checkout passt nicht zur gespeicherten Bestellung.",
        );
      if (event.type === "checkout.session.expired") {
        if (order.status === "pending") {
          await db.query(
            "UPDATE checkout_orders SET status='expired' WHERE id=$1",
            [order.id],
          );
          await db.query(
            "UPDATE launch_reservations SET expires_at=now() WHERE order_id=$1 AND redeemed_at IS NULL",
            [order.id],
          );
        }
      } else if (s.mode === "subscription" && s.payment_status === "paid") {
        const sub = await api.subscriptions.retrieve(String(s.subscription));
        if (
          sub.livemode ||
          sub.status !== "active" ||
          !sub.items.data.some((i) => i.price.id === order.stripe_price_id)
        )
          throw new AppError(409, "Testabo noch nicht aktiv.");
        await settle(
          db,
          order.id,
          event.id,
          sub.items.data[0]?.current_period_end,
          s.amount_total ?? undefined,
        );
        await db.query(
          "UPDATE organizations SET stripe_customer_id=$2,stripe_subscription_id=$3,stripe_event_at=greatest(stripe_event_at,$4) WHERE id=$1",
          [tenantId, String(s.customer), sub.id, event.created],
        );
      }
    } else if (event.type === "invoice.paid") {
      const invoice = obj as Stripe.Invoice;
      const [order] = await rows(
        db,
        "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND stripe_invoice_id=$2 AND status='pending'",
        [tenantId, invoice.id],
      );
      if (order && invoice.status === "paid") {
        const sub = await api.subscriptions.retrieve(
          org.stripe_subscription_id,
        );
        if (
          sub.status === "active" &&
          !sub.pending_update &&
          sub.items.data.some((i) => i.price.id === order.stripe_price_id)
        )
          await settle(
            db,
            order.id,
            event.id,
            sub.items.data[0]?.current_period_end,
            invoice.amount_paid,
          );
      }
      if (
        !order &&
        invoice.status === "paid" &&
        invoice.billing_reason === "subscription_cycle" &&
        event.created >= Number(org.stripe_event_at)
      ) {
        const current = await api.subscriptions.retrieve(
          org.stripe_subscription_id,
        );
        if (current.status === "active" && !current.livemode) {
          await db.query(
            "UPDATE organizations SET subscription_status='active',period_ends_at=to_timestamp($2),stripe_event_at=$3 WHERE id=$1",
            [
              tenantId,
              current.items.data[0]?.current_period_end,
              event.created,
            ],
          );
          await db.query(
            "INSERT INTO billing_events(tenant_id,event_key,kind,plan,amount_cents) VALUES($1,$2,'stripe_test_renewal',$3,$4) ON CONFLICT(event_key) DO NOTHING",
            [tenantId, `invoice:${invoice.id}`, org.plan, invoice.amount_paid],
          );
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      // Pending tariff changes do not revoke a paid existing package; renewal failures do.
      const invoice = obj as Stripe.Invoice;
      if (
        invoice.billing_reason === "subscription_cycle" &&
        event.created >= Number(org.stripe_event_at)
      ) {
        const current = await api.invoices.retrieve(invoice.id);
        if (current.status !== "paid")
          await db.query(
            "UPDATE organizations SET subscription_status='past_due',stripe_event_at=$2 WHERE id=$1",
            [tenantId, event.created],
          );
      }
    } else if (
      [
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type) &&
      event.created >= Number(org.stripe_event_at)
    ) {
      const s = obj as Stripe.Subscription;
      await db.query(
        "UPDATE organizations SET subscription_status=$2,cancel_at_period_end=$3,period_ends_at=to_timestamp($4),stripe_event_at=$5 WHERE id=$1",
        [
          tenantId,
          s.status === "canceled"
            ? "canceled"
            : s.status === "active"
              ? ["canceled", "past_due"].includes(org.subscription_status)
                ? org.subscription_status
                : "active"
              : s.status === "trialing"
                ? "trialing"
                : "past_due",
          s.cancel_at_period_end,
          s.items.data[0]?.current_period_end,
          event.created,
        ],
      );
    }
    return { received: true };
  }, tenantId);
}
