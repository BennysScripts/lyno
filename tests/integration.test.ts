import path from "node:path";
const mailboxDirectory = path.join(
  process.env.LYNO_DATA_DIR || ".local",
  "mail",
);
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import {
  register,
  login,
  getContext,
  requestReset,
  resetPassword,
  verifyEmail,
} from "../src/lib/auth";
import { rows, query, transaction, pool } from "../src/lib/db";
import {
  changeMember,
  acceptInvite,
  invite,
  teamAction,
  deleteCompany,
  deleteAccount,
} from "../src/lib/core";
import { saveTemplate, startWorkflow, taskAction } from "../src/lib/flow";
import { saveArticle, readableArticles } from "../src/lib/academy";
import { assist } from "../src/lib/assist";
import { subscription, stripeWebhook } from "../src/lib/billing";
import { insights } from "../src/lib/insights";
import { runJobs } from "../src/lib/jobs";
import { confirmWaitlist, joinWaitlist } from "../src/lib/public";
import { customerKey } from "../src/lib/discount";
import { type Context } from "../src/lib/security";
const suffix = crypto.randomUUID().slice(0, 8);
const password = "Integration-Lyno-2026!";
const adminPool = new Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
let owner: Context, other: Context, member: Context, viewer: Context;
let ownerSession: string;
let templateId: string, articleId: string, workflowId: string, teamId: string;
const users: string[] = [];
const orgs: string[] = [];
async function makeUser(label: string) {
  const email = `${label}.${suffix}@tests.example`;
  const r = await register({
    name: `Test ${label}`,
    email,
    password,
    company: `Test ${label} ${suffix}`,
  });
  users.push(r.userId);
  orgs.push(r.tenantId);
  return { ctx: await getContext(r.session), session: r.session };
}
async function mailbox(email: string, subject: string) {
  const files = (await readdir(mailboxDirectory)).sort().reverse();
  for (const f of files) {
    const m = JSON.parse(
      await readFile(path.join(mailboxDirectory, f), "utf8"),
    );
    if (m.to === email && m.subject.includes(subject)) return m;
  }
  throw new Error("Keine Testnachricht gefunden");
}
async function tokenFrom(email: string, subject: string) {
  const mail = await mailbox(email, subject);
  return new URL(mail.text).searchParams.get("token")!;
}
beforeAll(async () => {
  const a = await makeUser("owner");
  owner = a.ctx;
  ownerSession = a.session;
  other = (await makeUser("other")).ctx;
  member = (await makeUser("member")).ctx;
  viewer = (await makeUser("viewer")).ctx;
  await query(
    "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'member'),($1,$3,'viewer')",
    [owner.tenantId, member.userId, viewer.userId],
  );
  member = { ...member, tenantId: owner.tenantId, role: "member" };
  viewer = { ...viewer, tenantId: owner.tenantId, role: "viewer" };
  const raw = await tokenFrom(owner.email, "bestätigen");
  await verifyEmail(raw);
  owner = { ...owner, verified: true };
});
afterAll(async () => {
  await adminPool.query("DELETE FROM paying_customers WHERE customer_key=$1", [
    customerKey(owner),
  ]);
  // Only identities and organizations created by this test run are removed.
  for (const id of orgs)
    await adminPool.query("DELETE FROM organizations WHERE id=$1", [id]);
  for (const id of users)
    await adminPool.query("DELETE FROM users WHERE id=$1", [id]);
  await adminPool.query("DELETE FROM waitlist WHERE email=$1", [
    `waitlist.${suffix}@tests.example`,
  ]);
  await adminPool.query("DELETE FROM webhook_events WHERE id=$1", [
    `evt_fixture_${suffix}`,
  ]);
  await adminPool.end();
  await pool.end();
});
describe("CORE und PostgreSQL-Mandantentrennung", () => {
  it("bearbeitet Teams per ID und schützt Mitglieder vor gleichnamigen Neuanlagen", async () => {
    const team = await transaction(
      (db) =>
        teamAction(db, owner, {
          name: "Projektteam",
          userIds: [member.userId],
        }),
      owner.tenantId,
    );
    const article = await transaction(
      (db) =>
        saveArticle(db, owner, {
          title: "Projektteam Handbuch",
          body: "Teamgebundenes Wissen bleibt nach dem Umbenennen zugänglich.",
          visibility: "team",
          teamId: team.id,
        }),
      owner.tenantId,
    );
    await expect(
      transaction(
        (db) => teamAction(db, owner, { name: "Projektteam", userIds: [] }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await transaction(
        (db) =>
          rows(db, "SELECT user_id FROM team_members WHERE team_id=$1", [
            team.id,
          ]),
        owner.tenantId,
      ),
    ).toEqual([{ user_id: member.userId }]);
    for (const ctx of [other, member])
      await expect(
        transaction(
          (db) =>
            teamAction(db, ctx, {
              id: team.id,
              name: "Unzulässig",
              userIds: [],
            }),
          ctx.tenantId,
        ),
      ).rejects.toMatchObject({ status: ctx === other ? 404 : 403 });
    const renamed = await transaction(
      (db) =>
        teamAction(db, owner, {
          id: team.id,
          name: "Delivery",
          userIds: [member.userId],
        }),
      owner.tenantId,
    );
    expect(renamed.id).toBe(team.id);
    expect(renamed.name).toBe("Delivery");
    expect(
      (
        await transaction(
          (db) => readableArticles(db, member, "Projektteam Handbuch"),
          member.tenantId,
        )
      ).map((a) => a.id),
    ).toEqual([article.id]);
  });
  it("speichert Passwort- und Sessionhashes, authentifiziert und prüft Rollen aktuell", async () => {
    const [u] = await query("SELECT password_hash FROM users WHERE id=$1", [
      owner.userId,
    ]);
    expect(u.password_hash).not.toBe(password);
    const r = await login({ email: owner.email, password });
    expect((await getContext(r.session)).tenantId).toBe(owner.tenantId);
    expect(
      (
        await query("SELECT id_hash FROM sessions WHERE user_id=$1", [
          owner.userId,
        ])
      ).every((r) => r.id_hash !== ownerSession),
    ).toBe(true);
    await expect(
      login({ email: owner.email, password: "falsch" }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("RLS schützt auch Queries ohne expliziten Tenant-Filter und erzwingt WITH CHECK", async () => {
    const [role] = await query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
    expect(await query("SELECT * FROM templates")).toHaveLength(0);
    const ts = await transaction(
      (db) => rows(db, "SELECT * FROM templates"),
      owner.tenantId,
    );
    expect(ts.length).toBe(3);
    expect(ts.every((t) => t.tenant_id === owner.tenantId)).toBe(true);
    await expect(
      transaction(
        (db) =>
          db.query(
            "INSERT INTO categories(tenant_id,name) VALUES($1,'Cross-Tenant')",
            [other.tenantId],
          ),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("verhindert Rolleneskalation und Verlust des letzten Inhabers", async () => {
    await expect(
      transaction(
        (db) => changeMember(db, member, member.userId, { role: "owner" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transaction(
        (db) => changeMember(db, owner, owner.userId, { role: "member" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      transaction(
        (db) => changeMember(db, owner, other.userId, { role: "member" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("bindet Einladungen an verifizierte E-Mail-Adressen und erlaubt keine Wiederverwendung", async () => {
    await transaction(
      (db) => invite(db, owner, { email: other.email, role: "member" }),
      owner.tenantId,
    );
    const raw = await tokenFrom(other.email, "Einladung");
    await expect(acceptInvite(owner, { token: raw })).rejects.toMatchObject({
      status: 400,
    });
    await expect(acceptInvite(other, { token: raw })).rejects.toMatchObject({
      status: 403,
    });
    await verifyEmail(await tokenFrom(other.email, "bestätigen"));
    other = { ...other, verified: true };
    await acceptInvite(other, { token: raw });
    await expect(acceptInvite(other, { token: raw })).rejects.toMatchObject({
      status: 400,
    });
    expect(
      (
        await query(
          "SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2",
          [owner.tenantId, other.userId],
        )
      )[0].role,
    ).toBe("member");
  });
});
describe("FLOW mit Formularen, Bedingungen und Freigaben", () => {
  it("erstellt einen Prozess und isoliert fremde Ressourcen", async () => {
    const t = await transaction(
      (db) =>
        saveTemplate(db, owner, {
          name: "Testprozess",
          fields: [
            { key: "kunde", label: "Kunde", type: "text", required: true },
            {
              key: "access",
              label: "Zugang",
              type: "checkbox",
              required: false,
            },
          ],
          steps: [
            { title: "Briefing", kind: "task" },
            {
              title: "Zugang",
              kind: "task",
              condition: { field: "access", equals: true },
            },
            { title: "Freigabe", kind: "approval" },
          ],
        }),
      owner.tenantId,
    );
    templateId = t.id;
    await expect(
      transaction(
        (db) =>
          startWorkflow(db, other, {
            templateId,
            name: "Fremdzugriff",
            formData: { kunde: "Fremd" },
          }),
        other.tenantId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      transaction(
        (db) =>
          startWorkflow(db, owner, {
            templateId,
            name: "Pflicht fehlt",
            formData: {},
          }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const w = await transaction(
      (db) =>
        startWorkflow(db, member, {
          templateId,
          name: "Prüfablauf",
          formData: { kunde: "Test", access: false },
        }),
      owner.tenantId,
    );
    workflowId = w.id;
    const ts = await transaction(
      (db) =>
        rows(db, "SELECT * FROM tasks WHERE workflow_id=$1 ORDER BY position", [
          w.id,
        ]),
      owner.tenantId,
    );
    expect(ts.map((t) => t.status)).toEqual(["ready", "skipped", "pending"]);
  });
  it("erzwingt Reihenfolge und Freigaberecht; schützt vor doppelter Ausführung", async () => {
    const ts = await transaction(
      (db) =>
        rows(db, "SELECT * FROM tasks WHERE workflow_id=$1 ORDER BY position", [
          workflowId,
        ]),
      owner.tenantId,
    );
    await expect(
      transaction(
        (db) => taskAction(db, owner, ts[2].id, { action: "complete" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      transaction(
        (db) => taskAction(db, other, ts[0].id, { action: "complete" }),
        other.tenantId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      transaction(
        (db) => taskAction(db, viewer, ts[0].id, { action: "complete" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const results = await Promise.allSettled([
      transaction(
        (db) => taskAction(db, member, ts[0].id, { action: "complete" }),
        owner.tenantId,
      ),
      transaction(
        (db) => taskAction(db, member, ts[0].id, { action: "complete" }),
        owner.tenantId,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      transaction(
        (db) => taskAction(db, member, ts[2].id, { action: "complete" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await transaction(
      (db) => taskAction(db, owner, ts[2].id, { action: "complete" }),
      owner.tenantId,
    );
    const [w] = await transaction(
      (db) =>
        rows(db, "SELECT status,completed_at FROM workflows WHERE id=$1", [
          workflowId,
        ]),
      owner.tenantId,
    );
    expect(w.status).toBe("completed");
    expect(w.completed_at).toBeTruthy();
  });
  it("verbietet zusammengesetzte Fremdschlüssel über Unternehmensgrenzen", async () => {
    await expect(
      transaction(
        (db) =>
          db.query(
            "INSERT INTO tasks(tenant_id,workflow_id,title,position,kind,status) VALUES($1,$2,'Leak',99,'task','ready')",
            [other.tenantId, workflowId],
          ),
        other.tenantId,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("erzeugt echte Kennzahlen statt frei erfundener Werte", async () => {
    const s = await transaction(
      (db) => insights(db, owner, 30),
      owner.tenantId,
    );
    expect(s.summary.total).toBe(1);
    expect(s.summary.completed).toBe(1);
    expect(s.summary.active).toBe(0);
    const empty = await transaction(
      (db) => insights(db, other, 30),
      other.tenantId,
    );
    expect(empty.summary.total).toBe(0);
    expect(empty.summary.avg_hours).toBeNull();
  });
});
describe("ACADEMY, ASSIST und Jobs", () => {
  it("filtert Management- und Teamwissen auch für Assist", async () => {
    const team = await transaction(
      (db) =>
        teamAction(db, owner, {
          name: "Privates Team",
          userIds: [member.userId],
        }),
      owner.tenantId,
    );
    teamId = team.id;
    const a = await transaction(
      (db) =>
        saveArticle(db, owner, {
          title: "Geheimer ORBIT Beschluss",
          body: "ORBIT: Nur für das Management sichtbar.",
          visibility: "managers",
        }),
      owner.tenantId,
    );
    articleId = a.id;
    await transaction(
      (db) =>
        saveArticle(db, owner, {
          title: "ORBIT Teamwissen",
          body: "ORBIT: Sichtbar für unser spezielles Team.",
          visibility: "team",
          teamId,
        }),
      owner.tenantId,
    );
    expect(
      (
        await transaction(
          (db) => readableArticles(db, member, "ORBIT"),
          owner.tenantId,
        )
      ).map((a) => a.title),
    ).toEqual(["ORBIT Teamwissen"]);
    expect(
      await transaction(
        (db) => readableArticles(db, viewer, "ORBIT"),
        owner.tenantId,
      ),
    ).toHaveLength(0);
    await expect(
      transaction(
        (db) =>
          saveArticle(db, member, {
            title: "Unerlaubt",
            body: "Mindestens zehn Zeichen",
          }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const result = await transaction(
      (db) =>
        assist(db, member, { mode: "question", prompt: "Was ist ORBIT?" }),
      owner.tenantId,
    );
    expect(result.testMode).toBe(true);
    expect(result.sources.every((s) => s.id !== articleId)).toBe(true);
    expect(result.answer).not.toContain("Nur für das Management");
    await expect(
      transaction(
        (db) =>
          assist(db, member, {
            mode: "summary",
            prompt: "Fasse zusammen",
            articleId,
          }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("erstellt nur Entwürfe und erzwingt das Nutzungslimit", async () => {
    const [before] = await transaction(
      (db) => rows(db, "SELECT count(*)::int AS n FROM templates"),
      owner.tenantId,
    );
    const r = await transaction(
      (db) => assist(db, owner, { mode: "draft", prompt: "Projektübergabe" }),
      owner.tenantId,
    );
    expect(r.draft?.steps).toHaveLength(3);
    const [after] = await transaction(
      (db) => rows(db, "SELECT count(*)::int AS n FROM templates"),
      owner.tenantId,
    );
    expect(after.n).toBe(before.n);
    await transaction(
      (db) =>
        db.query("UPDATE assist_usage SET count=50 WHERE tenant_id=$1", [
          owner.tenantId,
        ]),
      owner.tenantId,
    );
    await expect(
      transaction(
        (db) =>
          assist(db, owner, { mode: "question", prompt: "Weitere Frage" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("führt Wiederholungen und Erinnerungen idempotent aus", async () => {
    const t = await transaction(
      (db) =>
        saveTemplate(db, owner, {
          name: "Wiederkehrender Test",
          recurrenceDays: 7,
          steps: [{ title: "Wöchentliche Aufgabe", kind: "task", dueDays: 0 }],
          fields: [],
        }),
      owner.tenantId,
    );
    await transaction(
      (db) =>
        db.query(
          "UPDATE templates SET next_run_at=now()-interval '1 minute' WHERE id=$1",
          [t.id],
        ),
      owner.tenantId,
    );
    await runJobs([owner.tenantId]);
    await runJobs([owner.tenantId]);
    const [count] = await transaction(
      (db) =>
        rows(
          db,
          "SELECT count(*)::int AS n FROM workflows WHERE template_id=$1",
          [t.id],
        ),
      owner.tenantId,
    );
    expect(count.n).toBe(1);
    const duplicates = await transaction(
      (db) =>
        rows(
          db,
          "SELECT dedupe_key,count(*) FROM notifications GROUP BY dedupe_key HAVING count(*)>1 AND dedupe_key IS NOT NULL",
        ),
      owner.tenantId,
    );
    expect(duplicates).toHaveLength(0);
  });
});
describe("Vertrieb, Testabrechnung und Kontolebenszyklus", () => {
  it("bestätigt die Warteliste separat von der Marketing-Einwilligung", async () => {
    const email = `waitlist.${suffix}@tests.example`;
    await joinWaitlist({
      email,
      company: "Test GmbH",
      marketingConsent: false,
    });
    let [w] = await query("SELECT * FROM waitlist WHERE email=$1", [email]);
    expect(w.confirmed_at).toBeNull();
    expect(w.marketing_consent).toBe(false);
    const raw = await tokenFrom(email, "Beta-Anmeldung");
    await confirmWaitlist(raw);
    [w] = await query("SELECT * FROM waitlist WHERE email=$1", [email]);
    expect(w.confirmed_at).toBeTruthy();
    expect(w.marketing_consent).toBe(false);
    await expect(confirmWaitlist(raw)).rejects.toMatchObject({ status: 400 });
  });
  it("verweigert Abrechnung für Mitglieder; aktiviert und kündigt ein Testabo", async () => {
    await expect(
      transaction(
        (db) =>
          subscription(db, member, { action: "subscribe", plan: "business" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const checkout = await transaction(
      (db) =>
        subscription(db, owner, { action: "subscribe", plan: "business" }),
      owner.tenantId,
    );
    expect(
      (
        await query(
          "SELECT subscription_status FROM organizations WHERE id=$1",
          [owner.tenantId],
        )
      )[0].subscription_status,
    ).toBe("trialing");
    await transaction(
      (db) =>
        subscription(db, owner, {
          action: "confirm",
          orderId: checkout.orderId,
        }),
      owner.tenantId,
    );
    let [org] = await query("SELECT * FROM organizations WHERE id=$1", [
      owner.tenantId,
    ]);
    expect(org.subscription_status).toBe("active");
    expect(org.plan).toBe("business");
    await transaction(
      (db) => subscription(db, owner, { action: "cancel" }),
      owner.tenantId,
    );
    [org] = await query("SELECT * FROM organizations WHERE id=$1", [
      owner.tenantId,
    ]);
    expect(org.cancel_at_period_end).toBe(true);
    await transaction(
      (db) => subscription(db, owner, { action: "resume" }),
      owner.tenantId,
    );
    const events = await transaction(
      (db) => rows(db, "SELECT mode FROM billing_events"),
      owner.tenantId,
    );
    expect(events.every((e) => e.mode === "test")).toBe(true);
  });
  it("verarbeitet echte Zahlungsmodi niemals", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_live_forbidden_test";
    try {
      await expect(
        transaction(
          (db) =>
            subscription(db, owner, { action: "subscribe", plan: "business" }),
          owner.tenantId,
        ),
      ).rejects.toMatchObject({ status: 503 });
    } finally {
      if (prev) process.env.STRIPE_SECRET_KEY = prev;
      else delete process.env.STRIPE_SECRET_KEY;
    }
  });
  it("setzt Passwörter einmalig zurück und invalidiert aktive Sessions", async () => {
    const r = await login({ email: owner.email, password });
    await requestReset({ email: owner.email });
    const raw = await tokenFrom(owner.email, "Passwort zurücksetzen");
    const newPassword = "Neues-Lyno-Testpasswort!";
    await resetPassword({ token: raw, password: newPassword });
    await expect(getContext(r.session)).rejects.toMatchObject({ status: 401 });
    await expect(
      resetPassword({ token: raw, password: newPassword }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await getContext(
          (await login({ email: owner.email, password: newPassword })).session,
        )
      ).userId,
    ).toBe(owner.userId);
  });
  it("schützt Löschung durch Rolle, Passwort und exakte Bestätigung", async () => {
    await expect(
      transaction(
        (db) => deleteCompany(db, member, { password, confirmation: "Test" }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transaction(
        (db) =>
          deleteCompany(db, other, {
            password: "falsch",
            confirmation: `Test other ${suffix}`,
          }),
        other.tenantId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteAccount(other, { password, confirmation: "MEIN KONTO LÖSCHEN" }),
    ).rejects.toMatchObject({ status: 409 });
    await transaction(
      (db) =>
        deleteCompany(db, other, {
          password,
          confirmation: `Test other ${suffix}`,
        }),
      other.tenantId,
    );
    expect(
      await query("SELECT id FROM organizations WHERE id=$1", [other.tenantId]),
    ).toHaveLength(0);
    expect(
      await query("SELECT id FROM organizations WHERE id=$1", [owner.tenantId]),
    ).toHaveLength(1);
    await deleteAccount(other, {
      password,
      confirmation: "MEIN KONTO LÖSCHEN",
    });
    expect(
      await query("SELECT id FROM users WHERE id=$1", [other.userId]),
    ).toHaveLength(0);
  });
});

describe("Grenzfälle und Anbieterprotokolle", () => {
  it("paginiert ohne verlorene oder firmenfremde Abläufe", async () => {
    const { workflowList } = await import("../src/lib/workflow-list");
    await transaction(
      (db) =>
        db.query(
          "INSERT INTO workflows(tenant_id,name) SELECT $1,'Pagination '||i FROM generate_series(1,29) i",
          [owner.tenantId],
        ),
      owner.tenantId,
    );
    const first = await transaction(
      (db) => workflowList(db, owner, { search: "Pagination", page: 1 }),
      owner.tenantId,
    );
    const second = await transaction(
      (db) => workflowList(db, owner, { search: "Pagination", page: 2 }),
      owner.tenantId,
    );
    expect(first.total).toBe(29);
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(4);
    expect(
      new Set([...first.items, ...second.items].map((w) => w.id)).size,
    ).toBe(29);
  });
  it("sperrt Schreibzugriff nach Testphasenende und verarbeitet Kündigung", async () => {
    const { requireEntitlement } = await import("../src/lib/entitlements");
    await query(
      "UPDATE organizations SET subscription_status='trialing',trial_ends_at=now()-interval '1 second' WHERE id=$1",
      [owner.tenantId],
    );
    await expect(
      transaction(
        (db) => requireEntitlement(db, owner.tenantId),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 402 });
    await query(
      "UPDATE organizations SET subscription_status='active',cancel_at_period_end=true,period_ends_at=now()-interval '1 second' WHERE id=$1",
      [owner.tenantId],
    );
    await runJobs([owner.tenantId]);
    expect(
      (
        await query(
          "SELECT subscription_status FROM organizations WHERE id=$1",
          [owner.tenantId],
        )
      )[0].subscription_status,
    ).toBe("canceled");
    await query(
      "UPDATE organizations SET subscription_status='active',cancel_at_period_end=false,period_ends_at=now()+interval '1 month' WHERE id=$1",
      [owner.tenantId],
    );
  });
  it("prüft Stripe-Signaturen, Live-Sperre und wiederholte Events mit echten Signaturen ohne Netzaufruf", async () => {
    const { default: Stripe } = await import("stripe");
    const secret = "whsec_local_contract_fixture";
    const prevKey = process.env.STRIPE_SECRET_KEY,
      prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_local_contract_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const api = new Stripe(process.env.STRIPE_SECRET_KEY);
    const id = `sub_fixture_${suffix}`;
    await query(
      "UPDATE organizations SET stripe_subscription_id=$2 WHERE id=$1",
      [owner.tenantId, id],
    );
    const event = {
      id: `evt_fixture_${suffix}`,
      object: "event",
      type: "customer.subscription.updated",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id,
          object: "subscription",
          status: "active",
          cancel_at_period_end: true,
          items: {
            data: [
              { current_period_end: Math.floor(Date.now() / 1000) + 3600 },
            ],
          },
        },
      },
    };
    const send = async (e: unknown) => {
      const payload = JSON.stringify(e);
      return stripeWebhook(
        payload,
        api.webhooks.generateTestHeaderString({ payload, secret }),
      );
    };
    try {
      await expect(
        stripeWebhook(JSON.stringify(event), "bad-signature"),
      ).rejects.toMatchObject({ status: 400 });
      await expect(send({ ...event, livemode: true })).rejects.toMatchObject({
        status: 400,
      });
      await send(event);
      await send({
        ...event,
        data: { object: { ...event.data.object, cancel_at_period_end: false } },
      });
      expect(
        (
          await query(
            "SELECT cancel_at_period_end FROM organizations WHERE id=$1",
            [owner.tenantId],
          )
        )[0].cancel_at_period_end,
      ).toBe(true);
    } finally {
      await query(
        "UPDATE organizations SET stripe_subscription_id=NULL,cancel_at_period_end=false WHERE id=$1",
        [owner.tenantId],
      );
      if (prevKey) process.env.STRIPE_SECRET_KEY = prevKey;
      else delete process.env.STRIPE_SECRET_KEY;
      if (prevSecret) process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
      else delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });
});

describe("Mitarbeiter- und Paketgrenzen", () => {
  it("löst Aufgaben- und Vorlagenzuweisungen bei einer lesenden Rolle", async () => {
    const t = await transaction(
      (db) =>
        saveTemplate(db, owner, {
          name: "Zugewiesener Ablauf",
          steps: [
            { title: "Zugewiesen", kind: "task", assigneeId: member.userId },
          ],
          fields: [],
        }),
      owner.tenantId,
    );
    const w = await transaction(
      (db) =>
        startWorkflow(db, owner, {
          templateId: t.id,
          name: "Zuweisung testen",
        }),
      owner.tenantId,
    );
    await transaction(
      (db) => changeMember(db, owner, member.userId, { role: "viewer" }),
      owner.tenantId,
    );
    const [task] = await transaction(
      (db) =>
        rows(db, "SELECT assignee_id FROM tasks WHERE workflow_id=$1", [w.id]),
      owner.tenantId,
    );
    expect(task.assignee_id).toBeNull();
    const [updated] = await transaction(
      (db) => rows(db, "SELECT steps FROM templates WHERE id=$1", [t.id]),
      owner.tenantId,
    );
    expect(updated.steps[0].assigneeId).toBeUndefined();
    await expect(
      transaction(
        (db) =>
          saveTemplate(db, owner, {
            name: "Ungültige Zuweisung",
            steps: [
              {
                title: "Nicht bearbeitbar",
                kind: "task",
                assigneeId: member.userId,
              },
            ],
          }),
        owner.tenantId,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("erzwingt das Paketlimit bei zusätzlichen Mitgliedschaften", async () => {
    const { requireSeat } = await import("../src/lib/entitlements");
    await query("UPDATE organizations SET plan='starter' WHERE id=$1", [
      owner.tenantId,
    ]);
    const [current] = await query(
      "SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1",
      [owner.tenantId],
    );
    for (let i = current.n; i < 15; i++) {
      const [u] = await query(
        "INSERT INTO users(email,name,password_hash) VALUES($1,'Seat Test','test-fixture-no-login') RETURNING id",
        [`seat.${suffix}.${i}@tests.example`],
      );
      users.push(u.id);
      await query(
        "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'viewer')",
        [owner.tenantId, u.id],
      );
    }
    await expect(
      transaction((db) => requireSeat(db, owner.tenantId), owner.tenantId),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("Vollständige Löschung einer eigenen Testidentität", () => {
  it("verhindert verwaiste Stripe-Abos und offene Zahlungsaufträge bei Firmenlöschung", async () => {
    const { ctx } = await makeUser("billing-deletion");
    const input = { password, confirmation: `Test billing-deletion ${suffix}` };
    await adminPool.query(
      "UPDATE organizations SET stripe_subscription_id='sub_deletion_fixture',subscription_status='active' WHERE id=$1",
      [ctx.tenantId],
    );
    await expect(
      transaction((db) => deleteCompany(db, ctx, input), ctx.tenantId),
    ).rejects.toMatchObject({ status: 409 });
    await adminPool.query(
      "UPDATE organizations SET subscription_status='canceled' WHERE id=$1",
      [ctx.tenantId],
    );
    const op = (
      await adminPool.query(
        "INSERT INTO billing_operations(tenant_id,requested_by,action,payload) VALUES($1,$2,'cancel','{}') RETURNING id",
        [ctx.tenantId, ctx.userId],
      )
    ).rows[0];
    await expect(
      transaction((db) => deleteCompany(db, ctx, input), ctx.tenantId),
    ).rejects.toMatchObject({ status: 409 });
    await adminPool.query(
      "UPDATE billing_operations SET status='succeeded' WHERE id=$1",
      [op.id],
    );
    const order = (
      await adminPool.query(
        "INSERT INTO checkout_orders(tenant_id,plan,modules,amount_cents,provider,customer_key) VALUES($1,'starter','{}',4900,'stripe_test',$2) RETURNING id",
        [ctx.tenantId, customerKey(ctx)],
      )
    ).rows[0];
    await expect(
      transaction((db) => deleteCompany(db, ctx, input), ctx.tenantId),
    ).rejects.toMatchObject({ status: 409 });
    await adminPool.query(
      "UPDATE checkout_orders SET status='expired' WHERE id=$1",
      [order.id],
    );
    await transaction((db) => deleteCompany(db, ctx, input), ctx.tenantId);
    expect(
      await query("SELECT id FROM organizations WHERE id=$1", [ctx.tenantId]),
    ).toHaveLength(0);
  });
  it("entfernt nach ausdrücklichem Opt-in auch das letzte persönliche Konto", async () => {
    const { ctx } = await makeUser("deletion");
    await transaction(
      (db) =>
        deleteCompany(db, ctx, {
          password,
          confirmation: `Test deletion ${suffix}`,
          deletePersonalAccount: true,
        }),
      ctx.tenantId,
    );
    expect(
      await query("SELECT id FROM users WHERE id=$1", [ctx.userId]),
    ).toHaveLength(0);
    expect(
      await query("SELECT id FROM organizations WHERE id=$1", [ctx.tenantId]),
    ).toHaveLength(0);
  });
});
