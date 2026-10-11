import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { transaction, rows, pool } from "../src/lib/db";
import { quote, catalog } from "../src/lib/catalog";
import { subscription } from "../src/lib/billing";
import { campaignStatus, customerKey } from "../src/lib/discount";
import { requireEntitlement, requireAutomation } from "../src/lib/entitlements";
import {
  settingsSchema,
  saveSettings,
  savePreferences,
  customRole,
  assignRole,
  loadPermissions,
  requirePermission,
} from "../src/lib/customization";
import {
  uploadDocument,
  readableDocuments,
  saveLearningPath,
  completeLearning,
  learningPaths,
} from "../src/lib/learning";
import { saveArticle } from "../src/lib/academy";
import { search } from "../src/lib/search";
import { state } from "../src/lib/state";
import { assist } from "../src/lib/assist";
import type { Context } from "../src/lib/security";
const admin = new Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
const fixtures: Context[] = [];
async function company(label: string): Promise<Context> {
  const id = crypto.randomUUID();
  const email = `extension-${id}@tests.example`;
  const u = (
    await admin.query(
      "INSERT INTO users(name,email,password_hash,email_verified_at) VALUES($1,$2,'unused-test-service-identity',now()) RETURNING id",
      [label, email],
    )
  ).rows[0];
  const org = (
    await admin.query(
      "INSERT INTO organizations(name,plan) VALUES($1,'business') RETURNING id",
      [label],
    )
  ).rows[0];
  await admin.query(
    "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
    [org.id, u.id],
  );
  const ctx: Context = {
    tenantId: org.id,
    userId: u.id,
    role: "owner",
    verified: true,
    email,
    name: label,
    sessionHash: "",
  };
  fixtures.push(ctx);
  return ctx;
}
let owner: Context, other: Context, member: Context;
beforeAll(async () => {
  owner = await company("Extension owner");
  other = await company("Extension other");
  const p = await company("Extension member");
  member = { ...p, tenantId: owner.tenantId, role: "member" };
  await admin.query(
    "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'member')",
    [owner.tenantId, p.userId],
  );
});
afterAll(async () => {
  for (const c of fixtures) {
    await admin.query("DELETE FROM organizations WHERE id=$1", [c.tenantId]);
    await admin.query("DELETE FROM users WHERE id=$1", [c.userId]);
    await admin.query("DELETE FROM paying_customers WHERE customer_key=$1", [
      customerKey(c),
    ]);
  }
  await admin.end();
  await pool.end();
});
const tx = <T>(ctx: Context, fn: Parameters<typeof transaction<T>>[0]) =>
  transaction(fn, ctx.tenantId);
describe("Zentrale Pakete und bestätigte Buchungen", () => {
  it("berechnet CORE, Zusatzmodule und Bundle mit konsistenten Limits", () => {
    expect(quote({ plan: "starter", modules: [] }).amountCents).toBe(4900);
    expect(quote({ plan: "starter", modules: ["flow"] }).amountCents).toBe(
      8400,
    );
    expect(quote({ plan: "business" }).amountCents).toBe(29900);
    expect(catalog().plans[2].seats).toBe(150);
    expect(() =>
      quote({ plan: "premium", modules: ["flow", "flow"] }),
    ).toThrow();
  });
  it("aktiviert Module erst nach Bestätigung, bestätigt idempotent und verhindert fremde Zahlungen", async () => {
    const order = await tx(owner, (db) =>
      subscription(db, owner, {
        action: "subscribe",
        plan: "premium",
        modules: ["flow"],
      }),
    );
    expect(
      (
        await tx(owner, (db) =>
          rows(db, "SELECT plan FROM organizations WHERE id=$1", [
            owner.tenantId,
          ]),
        )
      )[0].plan,
    ).toBe("business");
    await expect(
      tx(other, (db) =>
        subscription(db, other, { action: "confirm", orderId: order.orderId }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      tx(member, (db) =>
        subscription(db, member, { action: "confirm", orderId: order.orderId }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await tx(owner, (db) =>
      subscription(db, owner, { action: "confirm", orderId: order.orderId }),
    );
    await tx(owner, (db) =>
      subscription(db, owner, { action: "confirm", orderId: order.orderId }),
    );
    await expect(
      tx(owner, (db) => requireEntitlement(db, owner.tenantId, "flow")),
    ).resolves.toMatchObject({ plan: { id: "premium" } });
    await expect(
      tx(owner, (db) =>
        requireEntitlement(db, owner.tenantId, "academy", false),
      ),
    ).rejects.toMatchObject({ status: 402 });
    const s = await tx(owner, (db) => state(db, owner));
    expect(s.articles).toEqual([]);
    expect(s.documents).toEqual([]);
    expect(s.insights.weekly).toEqual([]);
    expect(s.insights.processes).toEqual([]);
    expect(
      (
        await tx(owner, (db) =>
          rows(db, "SELECT * FROM billing_events WHERE tenant_id=$1", [
            owner.tenantId,
          ]),
        )
      ).length,
    ).toBe(1);
  });
  it("unterstützt Tarifwechsel und blockiert einen neuen Checkout solange eine Bestellung offen ist", async () => {
    const order = await tx(owner, (db) =>
      subscription(db, owner, { action: "subscribe", plan: "business" }),
    );
    await expect(
      tx(owner, (db) =>
        subscription(db, owner, { action: "subscribe", plan: "starter" }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await tx(owner, (db) =>
      subscription(db, owner, { action: "confirm", orderId: order.orderId }),
    );
    await expect(
      tx(owner, (db) => requireEntitlement(db, owner.tenantId, "academy")),
    ).resolves.toMatchObject({ plan: { id: "business" } });
  });
  it("weist abgelaufene Bestellungen und Überschreitung von Automationslimits zurück", async () => {
    const order = await tx(other, (db) =>
      subscription(db, other, { action: "subscribe", plan: "starter" }),
    );
    await admin.query(
      "UPDATE checkout_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [order.orderId],
    );
    await expect(
      tx(other, (db) =>
        subscription(db, other, { action: "confirm", orderId: order.orderId }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await tx(other, (db) =>
      subscription(db, other, { action: "abandon", orderId: order.orderId }),
    );
    await admin.query("UPDATE organizations SET plan='starter' WHERE id=$1", [
      other.tenantId,
    ]);
    await tx(other, async (db) => {
      for (let i = 0; i < 3; i++)
        await db.query(
          "INSERT INTO templates(tenant_id,name,steps,recurrence_days) VALUES($1,$2,'[]',1)",
          [other.tenantId, `Automation ${i}`],
        );
    });
    await expect(
      tx(other, (db) => requireAutomation(db, other.tenantId)),
    ).rejects.toMatchObject({ status: 409 });
  });
});
describe("Mandantengetrennte Anpassungen und individuelle Rollen", () => {
  it("speichert alle Moduleinstellungen dauerhaft und schützt Betreiberregeln", async () => {
    const settings = settingsSchema.parse({
      branding: { accent: "#334455", tagline: "Unser Team" },
      dashboard: { home: "academy", widgets: ["tasks"] },
      flow: { view: "board", priority: "high", reminderDays: 4 },
      academy: { sort: "title", welcome: "Willkommen" },
      assist: { tone: "detailed", dailyLimit: 2 },
      insights: { days: 90 },
    });
    await tx(owner, (db) => saveSettings(db, owner, settings));
    expect((await tx(owner, (db) => state(db, owner))).settings).toEqual(
      settings,
    );
    expect(
      (await tx(other, (db) => state(db, other))).settings.branding.tagline,
    ).not.toBe("Unser Team");
    await expect(
      tx(member, (db) => saveSettings(db, member, settings)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      tx(owner, (db) => db.query("UPDATE launch_campaign SET capacity=999")),
    ).rejects.toMatchObject({ code: "42501" });
    expect(() =>
      settingsSchema.parse({
        branding: { logo: "data:image/svg+xml;base64,PHN2Zz4=" },
      }),
    ).toThrow();
    expect(() =>
      settingsSchema.parse({
        branding: { logo: "data:image/png;base64,iVBORw0KGgo=" },
      }),
    ).toThrow();
    expect(
      settingsSchema.parse({
        branding: {
          logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
        },
      }).branding.logo,
    ).toContain("data:image/png");
  });
  it("begrenzt Basisrollen ohne Eskalation und filtert Inhalte aus dem App-Zustand", async () => {
    const role = await tx(owner, (db) =>
      customRole(db, owner, {
        name: "Nur Wissen",
        permissions: ["academy.read", "core.manage", "academy.write"],
      }),
    );
    await tx(owner, (db) =>
      assignRole(db, owner, { userId: member.userId, roleId: role.id }),
    );
    await tx(member, async (db) => {
      await loadPermissions(db, member);
      expect(() => requirePermission(member, "academy.read")).not.toThrow();
      expect(() => requirePermission(member, "core.manage")).toThrow();
      expect(() => requirePermission(member, "academy.write")).toThrow();
      expect(() => requirePermission(member, "flow.read")).toThrow();
      const s = await state(db, member);
      expect(s.workflows).toEqual([]);
    });
    await admin.query("UPDATE organizations SET plan='business' WHERE id=$1", [
      other.tenantId,
    ]);
    await admin.query(
      "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'member')",
      [other.tenantId, member.userId],
    );
    await expect(
      tx(other, (db) =>
        assignRole(db, other, { userId: member.userId, roleId: role.id }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await tx(owner, (db) =>
      assignRole(db, owner, { userId: member.userId, roleId: null }),
    );
    member.permissions = undefined;
  });
  it("hält gespeicherte Ansichten und Erinnerungen pro Person und Firma getrennt", async () => {
    await tx(member, (db) =>
      savePreferences(db, member, {
        reminders: false,
        savedViews: [
          {
            name: "Meine Freigaben",
            query: "Freigabe",
            status: "active",
            priority: "high",
          },
        ],
      }),
    );
    const a = await tx(member, (db) => state(db, member)),
      b = await tx(owner, (db) => state(db, owner));
    expect(a.preferences.reminders).toBe(false);
    expect(a.preferences.savedViews).toHaveLength(1);
    expect(b.preferences.savedViews).toHaveLength(0);
  });
  it("erzwingt das individuelle KI-Limit serverseitig", async () => {
    await tx(owner, (db) =>
      assist(db, owner, { mode: "question", prompt: "Was ist unser Ablauf?" }),
    );
    await tx(owner, (db) =>
      assist(db, owner, { mode: "question", prompt: "Was ist unser Ablauf?" }),
    );
    await expect(
      tx(owner, (db) =>
        assist(db, owner, {
          mode: "question",
          prompt: "Was ist unser Ablauf?",
        }),
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
});
describe("Wissen, Dokumente und Lernpfade", () => {
  let first: string, second: string, hidden: string;
  it("speichert Textdokumente als zitierbares Wissen und verhindert fremde/unerlaubte Downloads", async () => {
    const doc = await tx(owner, (db) =>
      uploadDocument(db, owner, {
        title: "Interne Kalkulation",
        filename: "kalkulation.txt",
        mime: "text/plain",
        base64: Buffer.from(
          "Die interne Kalkulation ist nur für das Management freigegeben.",
        ).toString("base64"),
        visibility: "managers",
      }),
    );
    expect(
      await tx(member, (db) => readableDocuments(db, member, doc.id, true)),
    ).toHaveLength(0);
    expect(
      await tx(other, (db) => readableDocuments(db, other, doc.id, true)),
    ).toHaveLength(0);
    const readable = await tx(owner, (db) =>
      readableDocuments(db, owner, doc.id, true),
    );
    hidden = readable[0].article_id;
    expect(readable[0].bytes.toString()).toContain("Kalkulation");
    expect(
      (await tx(member, (db) => search(db, member, "Kalkulation"))).items,
    ).toHaveLength(0);
    expect(
      (await tx(owner, (db) => search(db, owner, "Kalkulation"))).items,
    ).toHaveLength(2);
    await expect(
      tx(owner, (db) =>
        uploadDocument(db, owner, {
          title: "Fake PDF",
          filename: "test.pdf",
          mime: "application/pdf",
          base64: Buffer.from("<script>evil</script>").toString("base64"),
          visibility: "company",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("erzwingt geordnete Lernschritte und verbirgt Pfade mit gesperrten Quellen", async () => {
    first = (
      await tx(owner, (db) =>
        saveArticle(db, owner, {
          title: "Erster Tag",
          body: "Willkommen im Unternehmen.",
        }),
      )
    ).id;
    second = (
      await tx(owner, (db) =>
        saveArticle(db, owner, {
          title: "Zweiter Tag",
          body: "Heute lernen wir die Prozesse.",
        }),
      )
    ).id;
    const path = await tx(owner, (db) =>
      saveLearningPath(db, owner, {
        title: "Einarbeitung",
        articleIds: [first, second],
      }),
    );
    await tx(owner, (db) =>
      saveLearningPath(db, owner, {
        title: "Management",
        articleIds: [first, hidden],
      }),
    );
    expect(await tx(member, (db) => learningPaths(db, member))).toHaveLength(1);
    await expect(
      tx(member, (db) =>
        completeLearning(db, member, {
          pathId: path.id,
          articleId: second,
          complete: true,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await tx(member, (db) =>
      completeLearning(db, member, {
        pathId: path.id,
        articleId: first,
        complete: true,
      }),
    );
    await tx(member, (db) =>
      completeLearning(db, member, {
        pathId: path.id,
        articleId: second,
        complete: true,
      }),
    );
    expect(
      (await tx(member, (db) => learningPaths(db, member)))[0].completedIds,
    ).toHaveLength(2);
    expect(
      (await tx(owner, (db) => learningPaths(db, owner)))[0].completedIds,
    ).toHaveLength(0);
    await tx(member, (db) =>
      completeLearning(db, member, {
        pathId: path.id,
        articleId: first,
        complete: false,
      }),
    );
    expect(
      (await tx(member, (db) => learningPaths(db, member)))[0].completedIds,
    ).toHaveLength(0);
    await expect(
      tx(other, (db) =>
        saveLearningPath(db, other, {
          title: "Fremde Artikel",
          articleIds: [first],
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("Transaktionssicherer Startrabatt", () => {
  it("überbucht auch bei mehr parallelen Checkout-Reservierungen als freien Plätzen nicht", async () => {
    const before = await transaction(campaignStatus);
    expect(before.capacity).toBe(20);
    const contenders = await Promise.all(
      Array.from({ length: before.remaining + 3 }, (_, i) =>
        company(`Discount ${i}`),
      ),
    );
    const orders = await Promise.all(
      contenders.map((c) =>
        tx(c, (db) =>
          subscription(db, c, {
            action: "subscribe",
            plan: "starter",
            modules: [],
          }),
        ),
      ),
    );
    const ids = orders.map((o) => o.orderId);
    const reserved = (
      await admin.query(
        "SELECT count(*)::int AS n FROM launch_reservations WHERE order_id=ANY($1::uuid[]) AND expires_at>now()",
        [ids],
      )
    ).rows[0].n;
    expect(reserved).toBe(before.remaining);
    const after = await transaction(campaignStatus);
    expect(after.remaining).toBe(0);
    expect(after.reserved + after.redeemed).toBe(after.capacity);
    // Release only this test's inventory, then confirm an unrelated existing customer never receives a second discount.
    for (let i = 0; i < orders.length; i++)
      await tx(contenders[i], (db) =>
        subscription(db, contenders[i], {
          action: "abandon",
          orderId: orders[i].orderId,
        }),
      );
    const order = await tx(owner, (db) =>
      subscription(db, owner, { action: "subscribe", plan: "premium" }),
    );
    expect(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM launch_reservations WHERE order_id=$1",
          [order.orderId],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await tx(owner, (db) =>
          rows(db, "SELECT discount_percent FROM checkout_orders WHERE id=$1", [
            order.orderId,
          ]),
        )
      )[0].discount_percent,
    ).toBe(20);
    await tx(owner, (db) =>
      subscription(db, owner, { action: "abandon", orderId: order.orderId }),
    );
  }, 30000);
});
