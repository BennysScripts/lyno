import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { query, type DB } from "./db";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const uuid = z.string().uuid();
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12, "Mindestens 12 Zeichen erforderlich.")
  .max(128);
export const roles = ["owner", "admin", "manager", "member", "viewer"] as const;
export type Role = (typeof roles)[number];
export type Context = {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
  verified: boolean;
  sessionHash: string;
  permissions?: string[];
};
export const token = () => randomBytes(32).toString("hex");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const canManage = (role: Role) =>
  ["owner", "admin", "manager"].includes(role);
export function requireRole(ctx: Context, allowed: Role[]) {
  if (!allowed.includes(ctx.role))
    throw new AppError(403, "Dafür fehlt Ihnen die Berechtigung.");
}
export function requireWrite(ctx: Context) {
  requireRole(ctx, ["owner", "admin", "manager", "member"]);
}
export async function rateLimit(key: string, max = 10, seconds = 900) {
  const [r] = await query(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at < now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`,
    [hash(key), seconds],
  );
  if (r.count > max)
    throw new AppError(
      429,
      "Zu viele Versuche. Bitte versuchen Sie es später erneut.",
    );
}
export async function audit(
  db: DB,
  ctx: Context,
  action: string,
  entity?: string,
  details: Record<string, unknown> = {},
) {
  await db.query(
    "INSERT INTO audit_logs(tenant_id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)",
    [ctx.tenantId, ctx.userId, action, entity ?? null, JSON.stringify(details)],
  );
}
export function appUrl() {
  const u = process.env.APP_URL || "http://localhost:3000";
  return u.replace(/\/$/, "");
}
export function secureCookies() {
  const url = new URL(appUrl());
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !(
      process.env.ALLOW_INSECURE_LOCALHOST === "true" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new AppError(
      503,
      "Der sichere HTTPS-Betrieb ist noch nicht konfiguriert.",
    );
  return url.protocol === "https:";
}
export function checkOrigin(request: Request) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    request.headers.get("origin") !== new URL(appUrl()).origin
  )
    throw new AppError(
      403,
      "Ungültige Anfragequelle. Laden Sie die Seite neu.",
    );
}
