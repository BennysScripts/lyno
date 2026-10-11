import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, transaction, rows, type DB } from "./db";
import {
  AppError,
  hash,
  token,
  emailSchema,
  passwordSchema,
  rateLimit,
  appUrl,
  type Context,
} from "./security";
import { sendMail } from "./mail";
import { selectionSchema } from "./catalog";
import { bootstrap } from "./core";
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  company: z.string().trim().min(2).max(120),
  plan: selectionSchema.shape.plan.default("starter"),
  modules: selectionSchema.shape.modules,
});
export async function createSession(
  db: DB,
  userId: string,
  tenantId: string | null,
) {
  const raw = token();
  await db.query(
    "INSERT INTO sessions(id_hash,user_id,tenant_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
    [hash(raw), userId, tenantId],
  );
  return raw;
}
export async function register(input: unknown) {
  const data = registerSchema.parse(input);
  await rateLimit(`register:${data.email}`, 5, 3600);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const rawVerify = token();
  const result = await transaction(async (db) => {
    if (
      (await rows(db, "SELECT id FROM users WHERE email=$1", [data.email]))
        .length
    )
      throw new AppError(
        409,
        "Registrierung nicht möglich. Versuchen Sie die Anmeldung oder setzen Sie Ihr Passwort zurück.",
      );
    const [user] = await rows(
      db,
      "INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id",
      [data.email, data.name, passwordHash],
    );
    const [org] = await rows(
      db,
      "INSERT INTO organizations(name,plan,modules) VALUES($1,$2,$3) RETURNING id",
      [data.company, data.plan, data.modules],
    );
    await db.query(
      "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
      [org.id, user.id],
    );
    await db.query(
      "INSERT INTO auth_tokens(id_hash,user_id,purpose,expires_at) VALUES($1,$2,'verify',now()+interval '2 days')",
      [hash(rawVerify), user.id],
    );
    await db.query("SELECT set_config('app.tenant_id',$1,true)", [org.id]);
    await bootstrap(db, {
      userId: user.id,
      tenantId: org.id,
      role: "owner",
      email: data.email,
      name: data.name,
      verified: false,
      sessionHash: "",
    });
    await sendMail(
      data.email,
      "LYNO: E-Mail-Adresse bestätigen",
      `${appUrl()}/bestaetigen?token=${rawVerify}&type=verify`,
      db,
    );
    return {
      session: await createSession(db, user.id, org.id),
      tenantId: org.id,
      userId: user.id,
    };
  });
  return result;
}
export async function login(input: unknown) {
  const data = z
    .object({ email: emailSchema, password: z.string().min(1).max(128) })
    .parse(input);
  await rateLimit(`login:${data.email}`, 10);
  const [user] = await query("SELECT * FROM users WHERE email=$1", [
    data.email,
  ]);
  const valid = await bcrypt.compare(
    data.password,
    user?.password_hash ||
      "$2b$12$evYiJOfeIpWGU1GNgaTb4ueDO.tXS9e76dk07IyDb.jVoNL35L0hC",
  );
  if (!user || !valid)
    throw new AppError(401, "E-Mail-Adresse oder Passwort ist nicht korrekt.");
  return transaction(async (db) => {
    const [m] = await rows(
      db,
      "SELECT tenant_id FROM memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1",
      [user.id],
    );
    return { session: await createSession(db, user.id, m?.tenant_id ?? null) };
  });
}
export async function getContext(raw?: string): Promise<Context> {
  if (!raw) throw new AppError(401, "Bitte melden Sie sich an.");
  const [r] = await query(
    `SELECT s.id_hash,s.user_id,s.tenant_id,u.email,u.name,u.email_verified_at,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=s.user_id AND m.tenant_id=s.tenant_id WHERE s.id_hash=$1 AND s.expires_at>now()`,
    [hash(raw)],
  );
  if (!r) {
    const identity = await getIdentity(raw);
    if (identity)
      throw new AppError(428, "Bitte richten Sie ein Unternehmen ein.");
    throw new AppError(
      401,
      "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
    );
  }
  return {
    userId: r.user_id,
    tenantId: r.tenant_id,
    role: r.role,
    email: r.email,
    name: r.name,
    verified: !!r.email_verified_at,
    sessionHash: r.id_hash,
  };
}
export async function requestReset(input: unknown) {
  const { email } = z.object({ email: emailSchema }).parse(input);
  await rateLimit(`reset:${email}`, 4, 3600);
  const [user] = await query("SELECT id FROM users WHERE email=$1", [email]);
  if (user) {
    const raw = token();
    await query(
      "INSERT INTO auth_tokens(id_hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
      [hash(raw), user.id],
    );
    await sendMail(
      email,
      "LYNO: Passwort zurücksetzen",
      `${appUrl()}/passwort-neu?token=${raw}`,
    );
  }
  return {
    message:
      process.env.MAIL_MODE === "smtp"
        ? "Falls ein Konto existiert, wurde eine E-Mail für den Versand vorgemerkt."
        : "Falls ein Konto existiert, wurde eine Nachricht vorbereitet. Im lokalen Testbetrieb liegt sie im Dateipostfach.",
  };
}
export async function resetPassword(input: unknown) {
  const data = z
    .object({ token: z.string().length(64), password: passwordSchema })
    .parse(input);
  const pw = await bcrypt.hash(data.password, 12);
  await transaction(async (db) => {
    const [t] = await rows(
      db,
      "DELETE FROM auth_tokens WHERE id_hash=$1 AND purpose='reset' AND expires_at>now() RETURNING user_id",
      [hash(data.token)],
    );
    if (!t)
      throw new AppError(400, "Dieser Link ist ungültig oder abgelaufen.");
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      pw,
      t.user_id,
    ]);
    await db.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
    await db.query(
      "DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'",
      [t.user_id],
    );
  });
  return { message: "Passwort gespeichert. Sie können sich jetzt anmelden." };
}
export async function verifyEmail(raw: string) {
  await transaction(async (db) => {
    const [t] = await rows(
      db,
      "DELETE FROM auth_tokens WHERE id_hash=$1 AND purpose='verify' AND expires_at>now() RETURNING user_id",
      [hash(raw)],
    );
    if (!t)
      throw new AppError(400, "Dieser Link ist ungültig oder abgelaufen.");
    await db.query("UPDATE users SET email_verified_at=now() WHERE id=$1", [
      t.user_id,
    ]);
  });
  return { message: "Ihre E-Mail-Adresse ist bestätigt." };
}

export async function getIdentity(raw?: string) {
  if (!raw) throw new AppError(401, "Bitte melden Sie sich an.");
  const [r] = await query(
    "SELECT s.id_hash,s.user_id,u.email,u.name,u.email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=$1 AND s.expires_at>now()",
    [hash(raw)],
  );
  if (!r) throw new AppError(401, "Ihre Sitzung ist abgelaufen.");
  return {
    userId: r.user_id,
    email: r.email,
    name: r.name,
    verified: !!r.email_verified_at,
    sessionHash: r.id_hash,
  } as Omit<Context, "tenantId" | "role">;
}
