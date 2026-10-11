import bcrypt from "bcryptjs";
import { z } from "zod";
import { rows, query, type DB, transaction } from "./db";
import {
  AppError,
  audit,
  appUrl,
  hash,
  token,
  emailSchema,
  requireRole,
  uuid,
  roles,
  type Context,
  rateLimit,
} from "./security";
import { sendMail } from "./mail";
import { starterTemplates } from "./templates";
import { requireSeat } from "./entitlements";
export async function bootstrap(db: DB, ctx: Context) {
  for (const t of starterTemplates)
    await db.query(
      "INSERT INTO templates(tenant_id,name,description,steps,fields,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [
        ctx.tenantId,
        t.name,
        t.description,
        JSON.stringify(t.steps),
        JSON.stringify(t.fields),
        ctx.userId,
      ],
    );
  const [cat] = await rows(
    db,
    "INSERT INTO categories(tenant_id,name) VALUES($1,'Erste Schritte') RETURNING id",
    [ctx.tenantId],
  );
  const [a] = await rows(
    db,
    "INSERT INTO articles(tenant_id,title,body,category_id,author_id) VALUES($1,'Willkommen in Ihrem Arbeitsraum',$2,$3,$4) RETURNING id",
    [
      ctx.tenantId,
      "# Gemeinsam gut arbeiten\n\nHier entsteht Ihr Firmenwissen. Passen Sie diesen Startartikel an Ihre Abläufe an.\n\n## Ihr erster Ablauf\n\nÖffnen Sie Flow, wählen Sie eine Vorlage und starten Sie einen Prozess. Aufgaben werden nacheinander freigeschaltet. Freigaben sind dem Management vorbehalten.\n\n## Ihr Wissen\n\nArtikel können für das gesamte Unternehmen, das Management oder ein Team freigegeben werden. Assist berücksichtigt diese Zugriffsrechte.",
      cat.id,
      ctx.userId,
    ],
  );
  await db.query(
    "INSERT INTO checklist_items(tenant_id,title,article_id) VALUES($1,'Arbeitsraum kennenlernen',$2)",
    [ctx.tenantId, a.id],
  );
  await db.query(
    "INSERT INTO notifications(tenant_id,user_id,title) VALUES($1,$2,'Willkommen bei LYNO. Ihr Arbeitsraum ist bereit.')",
    [ctx.tenantId, ctx.userId],
  );
  await audit(db, ctx, "organization.created", ctx.tenantId);
}
export async function invite(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin"]);
  const d = z
    .object({
      email: emailSchema,
      role: z.enum(["admin", "manager", "member", "viewer"]),
    })
    .parse(input);
  if (ctx.role === "admin" && d.role === "admin")
    throw new AppError(403, "Nur Inhaber können Administratoren ernennen.");
  await rateLimit(`invite:${ctx.tenantId}:${d.email}`, 3, 3600);
  const raw = token();
  const [r] = await rows(
    db,
    "INSERT INTO invitations(tenant_id,email,role,token_hash) VALUES($1,$2,$3,$4) RETURNING id",
    [ctx.tenantId, d.email, d.role, hash(raw)],
  );
  await audit(db, ctx, "invitation.created", r.id, { role: d.role });
  await sendMail(
    d.email,
    "LYNO: Einladung zum Unternehmen",
    `${appUrl()}/einladung?token=${raw}`,
    db,
  );
  return {
    message:
      process.env.MAIL_MODE === "smtp"
        ? "Einladung für den Versand vorgemerkt."
        : "Einladung im lokalen Postfach vorbereitet.",
  };
}
export async function acceptInvite(ctx: Context, input: unknown) {
  const { token: raw } = z
    .object({ token: z.string().length(64) })
    .parse(input);
  // Tenant discovery requires the recipient's verified email; token alone never grants another user's membership.
  if (!ctx.verified)
    throw new AppError(403, "Bestätigen Sie zuerst Ihre E-Mail-Adresse.");
  // Invitations are RLS-scoped; safe lookup via narrowly scoped SECURITY DEFINER function installed by migration.
  const [lookup] = await query("SELECT * FROM lookup_invitation($1,$2)", [
    hash(raw),
    ctx.email,
  ]);
  if (!lookup)
    throw new AppError(
      400,
      "Einladung ungültig, abgelaufen oder für eine andere E-Mail-Adresse.",
    );
  return transaction(async (db) => {
    const [i] = await rows(
      db,
      "SELECT * FROM invitations WHERE tenant_id=$1 AND id=$2 AND accepted_at IS NULL AND expires_at>now() FOR UPDATE",
      [lookup.tenant_id, lookup.id],
    );
    if (!i) throw new AppError(409, "Diese Einladung wurde bereits verwendet.");
    if (
      !(
        await rows(
          db,
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2",
          [i.tenant_id, ctx.userId],
        )
      ).length
    )
      await requireSeat(db, i.tenant_id);
    await db.query(
      "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [i.tenant_id, ctx.userId, i.role],
    );
    await db.query(
      "UPDATE invitations SET accepted_at=now() WHERE id=$1 AND tenant_id=$2",
      [i.id, i.tenant_id],
    );
    await db.query(
      "UPDATE sessions SET tenant_id=$1 WHERE id_hash=$2 AND user_id=$3",
      [i.tenant_id, ctx.sessionHash, ctx.userId],
    );
    await audit(
      db,
      { ...ctx, tenantId: i.tenant_id },
      "invitation.accepted",
      i.id,
    );
    return { ok: true };
  }, lookup.tenant_id);
}
async function releaseAssignments(db: DB, tenantId: string, userId: string) {
  await db.query(
    "UPDATE tasks SET assignee_id=NULL WHERE tenant_id=$1 AND assignee_id=$2",
    [tenantId, userId],
  );
  await db.query(
    "UPDATE templates SET steps=(SELECT jsonb_agg(CASE WHEN element->>'assigneeId'=$2 THEN element-'assigneeId' ELSE element END ORDER BY ord) FROM jsonb_array_elements(steps) WITH ORDINALITY AS expanded(element,ord)) WHERE tenant_id=$1",
    [tenantId, userId],
  );
}
export async function changeMember(
  db: DB,
  ctx: Context,
  id: string,
  input: unknown,
) {
  requireRole(ctx, ["owner", "admin"]);
  const d = z
    .object({
      role: z.enum(roles).optional(),
      remove: z.boolean().default(false),
    })
    .parse(input);
  uuid.parse(id);
  // Serialize role changes and organization deletion to protect the last owner.
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.tenantId,
  ]);
  const [m] = await rows(
    db,
    "SELECT * FROM memberships WHERE tenant_id=$1 AND user_id=$2",
    [ctx.tenantId, id],
  );
  if (!m) throw new AppError(404, "Person nicht gefunden.");
  if (
    ctx.role !== "owner" &&
    (m.role === "owner" ||
      m.role === "admin" ||
      d.role === "owner" ||
      d.role === "admin")
  )
    throw new AppError(403, "Nur Inhaber können diese Rolle verändern.");
  if (m.role === "owner" && (d.remove || d.role !== "owner")) {
    const [n] = await rows(
      db,
      "SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1 AND role='owner'",
      [ctx.tenantId],
    );
    if (n.n <= 1)
      throw new AppError(
        409,
        "Das Unternehmen benötigt mindestens einen Inhaber.",
      );
  }
  if (d.remove || d.role === "viewer")
    await releaseAssignments(db, ctx.tenantId, id);
  if (d.remove) {
    await db.query(
      "DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2",
      [ctx.tenantId, id],
    );
    await db.query("DELETE FROM sessions WHERE tenant_id=$1 AND user_id=$2", [
      ctx.tenantId,
      id,
    ]);
  } else {
    if (!d.role) throw new AppError(400, "Rolle fehlt.");
    await db.query(
      "UPDATE memberships SET role=$3 WHERE tenant_id=$1 AND user_id=$2",
      [ctx.tenantId, id, d.role],
    );
  }
  await audit(
    db,
    ctx,
    d.remove ? "member.removed" : "member.role_changed",
    id,
    { role: d.role },
  );
  return { ok: true };
}
export async function teamAction(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin"]);
  const d = z
    .object({
      id: uuid.optional(),
      name: z.string().trim().min(2).max(80),
      userIds: z.array(uuid).max(100).default([]),
    })
    .parse(input);
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.tenantId,
  ]);
  if (
    d.id &&
    !(
      await rows(db, "SELECT id FROM teams WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        d.id,
      ])
    ).length
  )
    throw new AppError(404, "Team nicht gefunden.");
  if (
    (
      await rows(
        db,
        "SELECT id FROM teams WHERE tenant_id=$1 AND name=$2 AND id IS DISTINCT FROM $3::uuid",
        [ctx.tenantId, d.name, d.id || null],
      )
    ).length
  )
    throw new AppError(409, "Ein Team mit diesem Namen besteht bereits.");
  for (const id of d.userIds)
    if (
      !(
        await rows(
          db,
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2",
          [ctx.tenantId, id],
        )
      ).length
    )
      throw new AppError(400, "Person gehört nicht zum Unternehmen.");
  const [team] = d.id
    ? await rows(
        db,
        "UPDATE teams SET name=$3 WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [ctx.tenantId, d.id, d.name],
      )
    : await rows(
        db,
        "INSERT INTO teams(tenant_id,name) VALUES($1,$2) RETURNING *",
        [ctx.tenantId, d.name],
      );
  await db.query("DELETE FROM team_members WHERE tenant_id=$1 AND team_id=$2", [
    ctx.tenantId,
    team.id,
  ]);
  for (const id of new Set(d.userIds))
    await db.query(
      "INSERT INTO team_members(tenant_id,team_id,user_id) VALUES($1,$2,$3)",
      [ctx.tenantId, team.id, id],
    );
  await audit(db, ctx, "team.saved", team.id);
  return team;
}
export async function deleteAccount(ctx: Context, input: unknown) {
  const d = z
    .object({
      password: z.string().max(128),
      confirmation: z.literal("MEIN KONTO LÖSCHEN"),
    })
    .parse(input);
  const [u] = await query("SELECT password_hash FROM users WHERE id=$1", [
    ctx.userId,
  ]);
  if (!(await bcrypt.compare(d.password, u.password_hash)))
    throw new AppError(403, "Passwort ist nicht korrekt.");
  await transaction(async (db) => {
    const orgs = await rows(
      db,
      "SELECT o.id FROM organizations o JOIN memberships m ON m.tenant_id=o.id WHERE m.user_id=$1 ORDER BY o.id FOR UPDATE OF o",
      [ctx.userId],
    );
    for (const org of orgs) {
      const [m] = await rows(
        db,
        "SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2",
        [org.id, ctx.userId],
      );
      if (m?.role === "owner") {
        const [others] = await rows(
          db,
          "SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1 AND role='owner' AND user_id<>$2",
          [org.id, ctx.userId],
        );
        if (!others.n)
          throw new AppError(
            409,
            "Übertragen Sie zuerst die Inhaberrolle oder löschen Sie Ihr Unternehmen separat.",
          );
      }
      await db.query("SELECT set_config('app.tenant_id',$1,true)", [org.id]);
      await releaseAssignments(db, org.id, ctx.userId);
      await audit(
        db,
        { ...ctx, tenantId: org.id },
        "account.deleted",
        ctx.userId,
      );
    }
    await db.query("DELETE FROM users WHERE id=$1", [ctx.userId]);
  });
  return { ok: true };
}
export async function deleteCompany(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner"]);
  const d = z
    .object({
      password: z.string().max(128),
      confirmation: z.string(),
      deletePersonalAccount: z.boolean().default(false),
    })
    .parse(input);
  const [org] = await rows(
    db,
    "SELECT * FROM organizations WHERE id=$1 FOR UPDATE",
    [ctx.tenantId],
  );
  if (d.confirmation !== org.name)
    throw new AppError(
      400,
      "Geben Sie zur Bestätigung den exakten Firmennamen ein.",
    );
  const [u] = await rows(db, "SELECT password_hash FROM users WHERE id=$1", [
    ctx.userId,
  ]);
  if (!(await bcrypt.compare(d.password, u.password_hash)))
    throw new AppError(403, "Passwort ist nicht korrekt.");
  // Cascades are scoped to this organization. Identity deletion needs a separate opt-in.
  if (org.stripe_subscription_id && org.subscription_status !== "canceled")
    throw new AppError(
      409,
      "Beenden Sie zuerst Ihr Stripe-Testabo und warten Sie auf die bestätigte Beendigung. Eine Firmenlöschung darf kein laufendes Abo zurücklassen.",
    );
  if (
    (
      await rows(
        db,
        "SELECT 1 FROM checkout_orders WHERE tenant_id=$1 AND provider='stripe_test' AND status='pending' UNION ALL SELECT 1 FROM billing_operations WHERE tenant_id=$1 AND status<>'succeeded'",
        [ctx.tenantId],
      )
    ).length
  )
    throw new AppError(
      409,
      "Gleichen Sie zuerst offene Stripe-Testbestellungen und Abrechnungsaufträge ab. Danach kann das Unternehmen gelöscht werden.",
    );
  if (
    d.deletePersonalAccount &&
    (
      await rows(
        db,
        "SELECT 1 FROM memberships WHERE user_id=$1 AND tenant_id<>$2",
        [ctx.userId, ctx.tenantId],
      )
    ).length
  )
    throw new AppError(
      409,
      "Ihr persönliches Konto gehört noch zu weiteren Unternehmen. Entfernen Sie diese Mitgliedschaften zuerst.",
    );
  await db.query("DELETE FROM organizations WHERE id=$1", [ctx.tenantId]);
  if (d.deletePersonalAccount)
    await db.query("DELETE FROM users WHERE id=$1", [ctx.userId]);
  return { ok: true };
}
