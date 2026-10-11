import { mkdir, writeFile } from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import path from "node:path";
import nodemailer from "nodemailer";
import { z } from "zod";
import { AppError } from "./security";
import { rows, transaction, type DB } from "./db";
function smtpConfig() {
  const parsed = z
    .object({
      host: z.string().min(1),
      port: z.coerce
        .number()
        .int()
        .refine((p) => p === 465 || p === 587),
      user: z.string().min(1),
      password: z.string().min(1),
      from: z.string().email(),
    })
    .safeParse({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.MAIL_FROM,
    });
  if (!parsed.success)
    throw new AppError(
      503,
      "Der sichere SMTP-Versand ist nicht vollständig konfiguriert.",
    );
  return parsed.data;
}
function encryptionKey() {
  const key = Buffer.from(process.env.MAIL_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32)
    throw new AppError(
      503,
      "Der Schlüssel für die Versandwarteschlange fehlt.",
    );
  return key;
}
function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
function decrypt(text: string) {
  const [iv, tag, body] = text.split(".").map((v) => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8");
}
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  db?: DB,
) {
  const mode = process.env.MAIL_MODE || "local";
  if (mode === "smtp") {
    smtpConfig();
    const payload = encrypt(JSON.stringify({ to, subject, text }));
    const enqueue = async (connection: DB) =>
      (
        await rows(
          connection,
          "INSERT INTO mail_outbox(payload) VALUES($1) RETURNING id",
          [payload],
        )
      )[0];
    const result = db ? await enqueue(db) : await transaction(enqueue);
    return { id: result.id as string, mode };
  }
  if (mode !== "local") throw new AppError(503, "Unbekannter Versandmodus.");
  const dir = path.join(
    process.env.LYNO_DATA_DIR || path.join(process.cwd(), ".local"),
    "mail",
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  await writeFile(
    path.join(dir, `${Date.now()}-${id}.json`),
    JSON.stringify(
      {
        to,
        subject,
        text,
        mode: "local-test",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return { id, mode };
}
export async function deliverMail(ids?: string[]) {
  if (process.env.MAIL_MODE !== "smtp") return { sent: 0, failed: 0 };
  const config = smtpConfig();
  encryptionKey();
  let sent = 0,
    failed = 0;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  // One message per transaction: independent workers skip in-flight rows.
  for (let i = 0; i < 10; i++) {
    const found = await transaction(async (db) => {
      const [mail] = await rows(
        db,
        "SELECT * FROM mail_outbox WHERE status='queued' AND available_at<=now() AND ($1::uuid[] IS NULL OR id=ANY($1)) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        [ids ?? null],
      );
      if (!mail) return false;
      try {
        const message = z
          .object({
            to: z.string().email(),
            subject: z.string().max(300),
            text: z.string().max(20000),
          })
          .parse(JSON.parse(decrypt(mail.payload)));
        await transport.sendMail({
          ...message,
          from: config.from,
          messageId: `<${mail.id}@${config.from.split("@")[1]}>`,
        });
        await db.query(
          "UPDATE mail_outbox SET status='sent',sent_at=now(),attempts=attempts+1,payload='',last_error=NULL WHERE id=$1",
          [mail.id],
        );
        sent++;
      } catch {
        await db.query(
          "UPDATE mail_outbox SET attempts=attempts+1,status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'queued' END,available_at=now()+power(2,attempts+1)*interval '1 minute',last_error='delivery_failed' WHERE id=$1",
          [mail.id],
        );
        failed++;
      }
      return true;
    });
    if (!found) break;
  }
  transport.close();
  return { sent, failed };
}
