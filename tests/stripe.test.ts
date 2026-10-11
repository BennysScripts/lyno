import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Pool } from "pg";
const mock = vi.hoisted(() => ({
  product: vi.fn(),
  price: vi.fn(),
  coupon: vi.fn(),
  checkout: vi.fn(),
  expire: vi.fn(),
  session: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  invoice: vi.fn(),
  voidInvoice: vi.fn(),
  portal: vi.fn(),
  configuration: vi.fn(),
}));
vi.mock("stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("stripe")>();
  class MockStripe extends original.default {
    constructor(...args: ConstructorParameters<typeof original.default>) {
      super(...args);
      Object.assign(this.products, { create: mock.product });
      Object.assign(this.prices, { create: mock.price });
      Object.assign(this.coupons, { create: mock.coupon });
      Object.assign(this.checkout.sessions, {
        create: mock.checkout,
        expire: mock.expire,
        retrieve: mock.session,
      });
      Object.assign(this.subscriptions, {
        retrieve: mock.retrieve,
        update: mock.update,
      });
      Object.assign(this.invoices, {
        retrieve: mock.invoice,
        voidInvoice: mock.voidInvoice,
      });
      Object.assign(this.billingPortal.sessions, { create: mock.portal });
      Object.assign(this.billingPortal.configurations, {
        create: mock.configuration,
      });
    }
  }
  return { ...original, default: MockStripe };
});
import Stripe from "stripe";
import {
  processBillingOperation,
  reconcileStripeTenant,
  runBillingJobs,
} from "../src/lib/billing-operations";
import { subscription, stripeWebhook } from "../src/lib/billing";
import { transaction, rows, pool } from "../src/lib/db";
import { customerKey } from "../src/lib/discount";
import type { Context } from "../src/lib/security";
const admin = new Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
const originalKey = process.env.STRIPE_SECRET_KEY,
  originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
let ctx: Context,
  sub: Record<string, unknown>,
  orderId: string,
  sessionId: string;
const eventIds: string[] = [];
const fixtures: Context[] = [];
const cachedPrices = new Map<string, string>();
const cachedCheckouts = new Map<string, string>();
const secret = "whsec_lyno_fixture_only";
const now = Math.floor(Date.now() / 1000);
async function event(type: string, object: unknown, offset = 0, live = false) {
  const id = `evt_${crypto.randomUUID()}`;
  eventIds.push(id);
  const body = JSON.stringify({
    id,
    object: "event",
    type,
    created: now + offset,
    livemode: live,
    data: { object },
  });
  const api = new Stripe("sk_test_fixture");
  const signature = api.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return { id, body, signature };
}
async function bill(input: unknown) {
  const prepared = await tx((db) => subscription(db, ctx, input));
  return "billingOperationId" in prepared && prepared.billingOperationId
    ? {
        ...prepared,
        ...(await processBillingOperation(
          ctx.tenantId,
          prepared.billingOperationId,
          true,
        )),
      }
    : prepared;
}
const tx = <T>(fn: Parameters<typeof transaction<T>>[0]) =>
  transaction(fn, ctx.tenantId);
async function createFixture() {
  const id = crypto.randomUUID(),
    email = `stripe-${id}@tests.example`;
  const user = (
    await admin.query(
      "INSERT INTO users(name,email,password_hash,email_verified_at) VALUES('Stripe fixture',$1,'unused-test-service-identity',now()) RETURNING id",
      [email],
    )
  ).rows[0];
  const org = (
    await admin.query(
      "INSERT INTO organizations(name) VALUES('Stripe fixture') RETURNING id",
    )
  ).rows[0];
  await admin.query(
    "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
    [org.id, user.id],
  );
  const created: Context = {
    userId: user.id,
    tenantId: org.id,
    role: "owner",
    email,
    name: "Stripe fixture",
    verified: true,
    sessionHash: "",
  };
  fixtures.push(created);
  return created;
}
beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  ctx = await createFixture();
  mock.product.mockResolvedValue({ id: "prod_fixture" });
  mock.price.mockImplementation(async (_params, options) => {
    if (!cachedPrices.has(options.idempotencyKey))
      cachedPrices.set(options.idempotencyKey, `price_${crypto.randomUUID()}`);
    return { id: cachedPrices.get(options.idempotencyKey) };
  });
  mock.coupon.mockResolvedValue({ id: "coupon_fixture" });
  mock.checkout.mockImplementation(async (_params, options) => {
    if (!cachedCheckouts.has(options.idempotencyKey))
      cachedCheckouts.set(
        options.idempotencyKey,
        `cs_test_${crypto.randomUUID()}`,
      );
    return {
      id: cachedCheckouts.get(options.idempotencyKey),
      url: "https://checkout.stripe.com/test_fixture",
      livemode: false,
    };
  });
  mock.expire.mockResolvedValue({});
  mock.retrieve.mockImplementation(async () => sub);
  mock.update.mockImplementation(async () => ({
    ...sub,
    latest_invoice: {
      id: "in_fixture_change",
      hosted_invoice_url: "https://invoice.stripe.com/test_fixture",
    },
  }));
  mock.invoice.mockImplementation(async (id) => ({
    id,
    status: "open",
    livemode: false,
  }));
  mock.session.mockImplementation(async (id) => ({
    id,
    status: "open",
    livemode: false,
  }));
  mock.voidInvoice.mockResolvedValue({});
  mock.configuration.mockResolvedValue({ id: "bpc_fixture" });
  mock.portal.mockResolvedValue({
    url: "https://billing.stripe.com/test_fixture",
  });
});
afterAll(async () => {
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  for (const fixture of fixtures) {
    await admin.query("DELETE FROM organizations WHERE id=$1", [
      fixture.tenantId,
    ]);
    await admin.query("DELETE FROM users WHERE id=$1", [fixture.userId]);
    await admin.query("DELETE FROM paying_customers WHERE customer_key=$1", [
      customerKey(fixture),
    ]);
  }
  await admin.query("DELETE FROM webhook_events WHERE id=ANY($1::text[])", [
    eventIds,
  ]);
  await admin.end();
  await pool.end();
});
it("erstellt ausschließlich Testcheckout, hält Rechte zurück und verhindert lokale Stripe-Bestätigung", async () => {
  const prepared = await tx((db) =>
    subscription(db, ctx, {
      action: "subscribe",
      plan: "business",
      modules: ["flow", "academy"],
    }),
  );
  expect(mock.checkout).not.toHaveBeenCalled();
  const result = await processBillingOperation(
    ctx.tenantId,
    prepared.billingOperationId!,
  );
  orderId = result.orderId!;
  const [order] = await tx((db) =>
    rows(db, "SELECT * FROM checkout_orders WHERE id=$1", [orderId]),
  );
  sessionId = order.stripe_session_id;
  sub = {
    id: "sub_fixture",
    status: "active",
    livemode: false,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: "si_fixture",
          price: { id: order.stripe_price_id },
          current_period_end: now + 2592000,
        },
      ],
    },
  };
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT subscription_status FROM organizations WHERE id=$1", [
          ctx.tenantId,
        ]),
      )
    )[0].subscription_status,
  ).toBe("trialing");
  expect(mock.checkout.mock.calls[0][0].metadata.orderId).toBe(orderId);
  expect(mock.checkout.mock.calls[0][1].idempotencyKey).toBe(
    `lyno-checkout-${orderId}`,
  );
  await expect(
    tx((db) => subscription(db, ctx, { action: "confirm", orderId })),
  ).rejects.toMatchObject({ status: 403 });
});
it("weist falsche Signaturen, Live-Events und falsche Checkout-Zuordnungen zurück", async () => {
  await expect(stripeWebhook("{}", "invalid")).rejects.toMatchObject({
    status: 400,
  });
  const live = await event("checkout.session.completed", {}, 0, true);
  await expect(stripeWebhook(live.body, live.signature)).rejects.toMatchObject({
    status: 400,
  });
  const wrong = await event("checkout.session.completed", {
    id: "cs_wrong",
    metadata: { tenantId: ctx.tenantId, orderId },
    mode: "subscription",
    payment_status: "paid",
  });
  await expect(
    stripeWebhook(wrong.body, wrong.signature),
  ).rejects.toMatchObject({ status: 400 });
});
it("aktiviert nach signierter Zahlung genau einmal und behält Rabattreservierungen bei verzögerter Zustellung", async () => {
  await admin.query(
    "UPDATE checkout_orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
    [orderId],
  );
  const signed = await event("checkout.session.completed", {
    id: sessionId,
    mode: "subscription",
    payment_status: "paid",
    subscription: "sub_fixture",
    customer: "cus_fixture",
    amount_total: 21520,
    metadata: { tenantId: ctx.tenantId, orderId },
  });
  await stripeWebhook(signed.body, signed.signature);
  await stripeWebhook(signed.body, signed.signature);
  const [org] = await tx((db) =>
    rows(db, "SELECT * FROM organizations WHERE id=$1", [ctx.tenantId]),
  );
  expect(org.subscription_status).toBe("active");
  expect(org.modules).toEqual(["academy", "flow"]);
  expect(org.plan).toBe("business");
  const billing = await tx((db) =>
    rows(db, "SELECT * FROM billing_events WHERE tenant_id=$1", [ctx.tenantId]),
  );
  expect(billing).toHaveLength(1);
  expect(billing[0].amount_cents).toBe(21520);
});
it("stellt Tarifwechsel erst nach bezahlter Rechnung um und speichert den tatsächlichen Rechnungsbetrag", async () => {
  const result = await bill({ action: "subscribe", plan: "premium" });
  const id = result.orderId!;
  const [order] = await tx((db) =>
    rows(db, "SELECT * FROM checkout_orders WHERE id=$1", [id]),
  );
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT plan FROM organizations WHERE id=$1", [ctx.tenantId]),
      )
    )[0].plan,
  ).toBe("business");
  expect(mock.update.mock.calls.at(-1)?.[1].payment_behavior).toBe(
    "pending_if_incomplete",
  );
  sub = {
    ...sub,
    items: {
      data: [
        {
          id: "si_fixture",
          price: { id: order.stripe_price_id },
          current_period_end: now + 2592000,
        },
      ],
    },
  };
  const paid = await event(
    "invoice.paid",
    {
      id: "in_fixture_change",
      status: "paid",
      amount_paid: 12345,
      billing_reason: "subscription_update",
      parent: { subscription_details: { subscription: "sub_fixture" } },
    },
    1,
  );
  await stripeWebhook(paid.body, paid.signature);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT plan FROM organizations WHERE id=$1", [ctx.tenantId]),
      )
    )[0].plan,
  ).toBe("premium");
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT amount_cents FROM billing_events WHERE event_key=$1", [
          paid.id,
        ]),
      )
    )[0].amount_cents,
  ).toBe(12345);
});
it("behandelt fehlgeschlagene Verlängerung und nachträgliche Zahlung ohne veraltete Rückstufung", async () => {
  const invoice = {
    id: "in_fixture_renewal",
    status: "open",
    amount_paid: 0,
    billing_reason: "subscription_cycle",
    parent: { subscription_details: { subscription: "sub_fixture" } },
  };
  const failed = await event("invoice.payment_failed", invoice, 2);
  await stripeWebhook(failed.body, failed.signature);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT subscription_status FROM organizations WHERE id=$1", [
          ctx.tenantId,
        ]),
      )
    )[0].subscription_status,
  ).toBe("past_due");
  const paid = await event(
    "invoice.paid",
    { ...invoice, status: "paid", amount_paid: 39920 },
    3,
  );
  await stripeWebhook(paid.body, paid.signature);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT subscription_status FROM organizations WHERE id=$1", [
          ctx.tenantId,
        ]),
      )
    )[0].subscription_status,
  ).toBe("active");
  const stale = await event(
    "customer.subscription.updated",
    { ...sub, status: "past_due" },
    1,
  );
  await stripeWebhook(stale.body, stale.signature);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT subscription_status FROM organizations WHERE id=$1", [
          ctx.tenantId,
        ]),
      )
    )[0].subscription_status,
  ).toBe("active");
});
it("beschränkt das Portal auf Rechnungen, Zahlungsmittel und Endkündigung; verwirft offene Änderungsrechnungen", async () => {
  await tx((db) => subscription(db, ctx, { action: "portal" }));
  expect(
    mock.configuration.mock.calls[0][0].features.subscription_update.enabled,
  ).toBe(false);
  expect(
    mock.configuration.mock.calls[0][0].features.subscription_cancel.mode,
  ).toBe("at_period_end");
  const checkout = await bill({ action: "subscribe", plan: "business" });
  await bill({ action: "abandon", orderId: checkout.orderId });
  expect(mock.voidInvoice).toHaveBeenCalledWith(
    "in_fixture_change",
    {},
    expect.objectContaining({
      idempotencyKey: expect.stringContaining("lyno-abandon-"),
    }),
  );
});

it("speichert Auftrag und Rabatt vor Providerzugriff und wiederholt nach DB-Abbruch mit identischen Parametern", async () => {
  ctx = await createFixture();
  const prepared = await tx((db) =>
    subscription(db, ctx, { action: "subscribe", plan: "business" }),
  );
  const operationId = prepared.billingOperationId!;
  const [reserved] = await admin
    .query("SELECT * FROM launch_reservations WHERE order_id=$1", [
      prepared.orderId,
    ])
    .then((r) => r.rows);
  const callsBefore = mock.checkout.mock.calls.length;
  const connect = pool.connect.bind(pool);
  let failed = false;
  const intercepted = async () => {
    const client = await connect();
    return new Proxy(client, {
      get(target, property) {
        if (property === "query")
          return (sql: unknown, ...params: unknown[]) => {
            if (
              !failed &&
              typeof sql === "string" &&
              sql.startsWith("UPDATE billing_operations SET status='succeeded'")
            ) {
              failed = true;
              throw new Error(
                "simulated database connection loss after provider response",
              );
            }
            return Reflect.apply(target.query, target, [sql, ...params]);
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  const spy = vi
    .spyOn(pool, "connect")
    .mockImplementation(intercepted as typeof pool.connect);
  try {
    await processBillingOperation(ctx.tenantId, operationId);
  } finally {
    spy.mockRestore();
  }
  expect(failed).toBe(true);
  const [pending] = await tx((db) =>
    rows(db, "SELECT * FROM checkout_orders WHERE id=$1", [prepared.orderId]),
  );
  expect(pending.stripe_session_id).toBeNull();
  expect(pending.status).toBe("pending");
  const [op] = await tx((db) =>
    rows(db, "SELECT * FROM billing_operations WHERE id=$1", [operationId]),
  );
  expect(op.status).toBe("pending");
  expect(op.attempts).toBe(1);
  if (reserved)
    expect(
      (
        await admin.query(
          "SELECT 1 FROM launch_reservations WHERE order_id=$1 AND expires_at>now()",
          [prepared.orderId],
        )
      ).rowCount,
    ).toBe(1);
  await processBillingOperation(ctx.tenantId, operationId, true);
  expect(mock.checkout.mock.calls.length).toBe(callsBefore + 2);
  expect(mock.checkout.mock.calls[callsBefore]).toEqual(
    mock.checkout.mock.calls[callsBefore + 1],
  );
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT status FROM billing_operations WHERE id=$1", [
          operationId,
        ]),
      )
    )[0].status,
  ).toBe("succeeded");
  const other = await createFixture();
  await expect(
    transaction(
      (db) => subscription(db, other, { action: "retry", operationId }),
      other.tenantId,
    ),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    await transaction(
      (db) =>
        rows(db, "SELECT * FROM billing_operations WHERE id=$1", [operationId]),
      other.tenantId,
    ),
  ).toHaveLength(0);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT subscription_status FROM organizations WHERE id=$1", [
          ctx.tenantId,
        ]),
      )
    )[0].subscription_status,
  ).toBe("trialing");
});

it("holt verlorene Zahlungswebhooks anhand kanonischer Providerdaten genau einmal nach", async () => {
  const [order] = await tx((db) =>
    rows(
      db,
      "SELECT * FROM checkout_orders WHERE tenant_id=$1 AND status='pending'",
      [ctx.tenantId],
    ),
  );
  sub = {
    id: `sub_${ctx.tenantId}`,
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: "si_recovery",
          price: { id: order.stripe_price_id },
          current_period_end: now + 2592000,
        },
      ],
    },
    latest_invoice: {
      id: "in_recovery",
      status: "paid",
      livemode: false,
      amount_paid: 23920,
      billing_reason: "subscription_create",
    },
  };
  const canonical = {
    id: order.stripe_session_id,
    livemode: false,
    status: "complete",
    mode: "subscription",
    payment_status: "paid",
    metadata: { tenantId: ctx.tenantId, orderId: order.id },
    subscription: sub.id,
    customer: "cus_recovery",
    amount_total: 23920,
  };
  mock.session.mockResolvedValue(canonical);
  expect((await reconcileStripeTenant(ctx.tenantId)).checked).toBe(true);
  expect((await reconcileStripeTenant(ctx.tenantId)).checked).toBe(true);
  const delayed = await event("checkout.session.completed", canonical);
  await stripeWebhook(delayed.body, delayed.signature);
  const [org] = await tx((db) =>
    rows(db, "SELECT plan,subscription_status FROM organizations WHERE id=$1", [
      ctx.tenantId,
    ]),
  );
  expect(org).toMatchObject({
    plan: "business",
    subscription_status: "active",
  });
  expect(
    await tx((db) =>
      rows(db, "SELECT * FROM billing_events WHERE tenant_id=$1", [
        ctx.tenantId,
      ]),
    ),
  ).toHaveLength(1);
  await admin.query(
    "UPDATE organizations SET stripe_subscription_id='sub_newer_paid_subscription' WHERE id=$1",
    [ctx.tenantId],
  );
  const stale = await event("checkout.session.completed", canonical, -20);
  await stripeWebhook(stale.body, stale.signature);
  expect(
    (
      await tx((db) =>
        rows(
          db,
          "SELECT stripe_subscription_id FROM organizations WHERE id=$1",
          [ctx.tenantId],
        ),
      )
    )[0].stripe_subscription_id,
  ).toBe("sub_newer_paid_subscription");
});

it("gleicht verlorene Checkout-Abläufe ab und gibt erst nach Providerbestätigung den Rabattplatz frei", async () => {
  ctx = await createFixture();
  const result = await bill({
    action: "subscribe",
    plan: "starter",
    modules: [],
  });
  const [order] = await tx((db) =>
    rows(db, "SELECT * FROM checkout_orders WHERE id=$1", [result.orderId]),
  );
  mock.session.mockResolvedValue({
    id: order.stripe_session_id,
    livemode: false,
    status: "expired",
    metadata: { tenantId: ctx.tenantId, orderId: order.id },
  });
  expect((await runBillingJobs([ctx.tenantId])).checked).toBe(1);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT status FROM checkout_orders WHERE id=$1", [order.id]),
      )
    )[0].status,
  ).toBe("expired");
  expect(
    (
      await admin.query(
        "SELECT 1 FROM launch_reservations WHERE order_id=$1 AND expires_at>now()",
        [order.id],
      )
    ).rowCount,
  ).toBe(0);
});

it("verhindert doppelte Ausführung durch konkurrierende Worker und übernimmt verwaiste Leases", async () => {
  ctx = await createFixture();
  const prepared = await tx((db) =>
    subscription(db, ctx, { action: "subscribe", plan: "premium" }),
  );
  const operationId = prepared.billingOperationId!;
  await admin.query(
    "UPDATE billing_operations SET status='processing',lease_token=gen_random_uuid(),lease_until=now()-interval '1 minute' WHERE id=$1",
    [operationId],
  );
  const before = mock.checkout.mock.calls.length;
  await Promise.all([
    processBillingOperation(ctx.tenantId, operationId),
    processBillingOperation(ctx.tenantId, operationId),
  ]);
  expect(mock.checkout.mock.calls.length).toBe(before + 1);
  expect(
    (
      await tx((db) =>
        rows(db, "SELECT status FROM billing_operations WHERE id=$1", [
          operationId,
        ]),
      )
    )[0].status,
  ).toBe("succeeded");
});

it("stoppt Wiederholungen vor Ablauf der Provider-Idempotenzgarantie und benachrichtigt nur den Inhaber", async () => {
  ctx = await createFixture();
  const prepared = await tx((db) =>
    subscription(db, ctx, { action: "subscribe", plan: "business" }),
  );
  const operationId = prepared.billingOperationId!;
  await admin.query(
    "UPDATE billing_operations SET created_at=now()-interval '23 hours' WHERE id=$1",
    [operationId],
  );
  const before = mock.checkout.mock.calls.length;
  await processBillingOperation(ctx.tenantId, operationId, true);
  await processBillingOperation(ctx.tenantId, operationId, true);
  expect(mock.checkout.mock.calls.length).toBe(before);
  const [op] = await tx((db) =>
    rows(
      db,
      "SELECT status,last_error_code FROM billing_operations WHERE id=$1",
      [operationId],
    ),
  );
  expect(op).toMatchObject({
    status: "attention",
    last_error_code: "retry_window_expired",
  });
  const notes = await tx((db) =>
    rows(db, "SELECT user_id FROM notifications WHERE tenant_id=$1", [
      ctx.tenantId,
    ]),
  );
  expect(notes).toEqual([{ user_id: ctx.userId }]);
  await expect(
    tx((db) => subscription(db, ctx, { action: "subscribe", plan: "starter" })),
  ).rejects.toMatchObject({ status: 409 });
});
