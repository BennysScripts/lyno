import { imageSize } from "image-size";
import { z } from "zod";
import { rows, type DB } from "./db";
import { AppError, audit, requireRole, uuid, type Context } from "./security";
import { entitlements } from "./entitlements";
export const permissionIds = [
  "flow.read",
  "flow.write",
  "academy.read",
  "academy.write",
  "assist.use",
  "insights.read",
  "core.manage",
] as const;
export type Permission = (typeof permissionIds)[number];
export function permitted(ctx: Context, p: Permission) {
  if (ctx.role === "owner") return true;
  const baseline =
    p === "core.manage"
      ? ["admin"].includes(ctx.role)
      : p === "academy.write"
        ? ["admin", "manager"].includes(ctx.role)
        : p === "flow.write"
          ? ctx.role !== "viewer"
          : true;
  return baseline && (!ctx.permissions || ctx.permissions.includes(p));
}
export function requirePermission(ctx: Context, p: Permission) {
  if (!permitted(ctx, p))
    throw new AppError(403, "Ihre Rolle erlaubt diese Funktion nicht.");
}
export async function loadPermissions(db: DB, ctx: Context) {
  const [r] = await rows(
    db,
    "SELECT r.permissions FROM memberships m JOIN custom_roles r ON r.tenant_id=m.tenant_id AND r.id=m.custom_role_id WHERE m.tenant_id=$1 AND m.user_id=$2",
    [ctx.tenantId, ctx.userId],
  );
  ctx.permissions = r?.permissions;
  return permissionIds.filter((p) => permitted(ctx, p));
}
function safeLogo(value: string) {
  if (!value) return true;
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const b = Buffer.from(match[2], "base64");
  if (b.length > 250000) return false;
  try {
    const size = imageSize(b);
    return (
      size.width > 0 &&
      size.height > 0 &&
      size.width <= 1024 &&
      size.height <= 1024 &&
      size.type === (match[1] === "jpeg" ? "jpg" : match[1])
    );
  } catch {
    return false;
  }
}
export const settingsSchema = z.object({
  branding: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default("#315bc1"),
      logo: z
        .string()
        .max(340000)
        .refine(
          safeLogo,
          "Nur PNG-, JPEG- und WebP-Logos bis 250 KB und 1024 × 1024 Pixel sind erlaubt.",
        )
        .default(""),
      tagline: z.string().trim().max(100).default("Gemeinsam klarer arbeiten."),
    })
    .default({
      accent: "#315bc1",
      logo: "",
      tagline: "Gemeinsam klarer arbeiten.",
    }),
  dashboard: z
    .object({
      widgets: z
        .array(z.enum(["tasks", "workflows", "knowledge", "activity", "stats"]))
        .max(5)
        .refine((v) => new Set(v).size === v.length)
        .default(["tasks", "workflows", "knowledge"]),
      home: z
        .enum(["overview", "flow", "academy", "assist", "insights"])
        .default("overview"),
    })
    .default({
      widgets: ["tasks", "workflows", "knowledge"],
      home: "overview",
    }),
  flow: z
    .object({
      view: z.enum(["list", "board"]).default("list"),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      reminderDays: z.number().int().min(0).max(14).default(1),
    })
    .default({ view: "list", priority: "normal", reminderDays: 1 }),
  academy: z
    .object({
      sort: z.enum(["updated", "title"]).default("updated"),
      welcome: z
        .string()
        .trim()
        .max(250)
        .default("Wissen teilen. Gemeinsam weiterkommen."),
    })
    .default({
      sort: "updated",
      welcome: "Wissen teilen. Gemeinsam weiterkommen.",
    }),
  assist: z
    .object({
      tone: z.enum(["concise", "detailed"]).default("concise"),
      dailyLimit: z.number().int().min(1).max(1000).default(50),
    })
    .default({ tone: "concise", dailyLimit: 50 }),
  insights: z
    .object({ days: z.number().int().min(7).max(365).default(30) })
    .default({ days: 30 }),
});
export type CompanySettings = z.infer<typeof settingsSchema>;
export const preferencesSchema = z.object({
  reminders: z.boolean().default(true),
  savedViews: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(50),
        status: z.enum(["all", "active", "completed", "canceled"]),
        priority: z.enum(["all", "low", "normal", "high", "urgent"]),
        query: z.string().max(120),
      }),
    )
    .max(12)
    .default([]),
});
export async function saveSettings(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin"]);
  requirePermission(ctx, "core.manage");
  const d = settingsSchema.parse(input);
  const { plan } = await entitlements(db, ctx.tenantId);
  if (d.assist.dailyLimit > plan.aiDaily)
    throw new AppError(
      409,
      `Das Paket erlaubt maximal ${plan.aiDaily} KI-Anfragen am Tag.`,
    );
  await db.query("UPDATE organizations SET settings=$2 WHERE id=$1", [
    ctx.tenantId,
    JSON.stringify(d),
  ]);
  await audit(db, ctx, "settings.updated", ctx.tenantId);
  return { message: "Firmenanpassungen gespeichert." };
}
export async function savePreferences(db: DB, ctx: Context, input: unknown) {
  const d = preferencesSchema.parse(input);
  await db.query(
    "INSERT INTO user_preferences(tenant_id,user_id,settings) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE SET settings=excluded.settings",
    [ctx.tenantId, ctx.userId, JSON.stringify(d)],
  );
  return {
    message: "Persönliche Ansichten und Benachrichtigungen gespeichert.",
  };
}
export async function customRole(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin"]);
  requirePermission(ctx, "core.manage");
  const { plan, active } = await entitlements(db, ctx.tenantId);
  if (!active || !plan.customRoles)
    throw new AppError(402, "Individuelle Rollen sind ab Business verfügbar.");
  const d = z
    .object({
      id: uuid.optional(),
      name: z.string().trim().min(2).max(60),
      permissions: z.array(z.enum(permissionIds)).max(7),
    })
    .parse(input);
  if (d.permissions.some((p) => !permitted(ctx, p)))
    throw new AppError(403, "Sie dürfen nur eigene Berechtigungen delegieren.");
  const result = d.id
    ? await rows(
        db,
        "UPDATE custom_roles SET name=$3,permissions=$4 WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [ctx.tenantId, d.id, d.name, d.permissions],
      )
    : await rows(
        db,
        "INSERT INTO custom_roles(tenant_id,name,permissions) VALUES($1,$2,$3) RETURNING *",
        [ctx.tenantId, d.name, d.permissions],
      );
  if (!result.length) throw new AppError(404, "Rolle nicht gefunden.");
  await audit(db, ctx, "role.saved", result[0].id);
  return result[0];
}
export async function assignRole(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin"]);
  requirePermission(ctx, "core.manage");
  const d = z.object({ userId: uuid, roleId: uuid.nullable() }).parse(input);
  const { plan, active } = await entitlements(db, ctx.tenantId);
  if (d.roleId && (!active || !plan.customRoles))
    throw new AppError(402, "Individuelle Rollen sind ab Business verfügbar.");
  const [m] = await rows(
    db,
    "SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2",
    [ctx.tenantId, d.userId],
  );
  if (!m || m.role === "owner" || (ctx.role !== "owner" && m.role === "admin"))
    throw new AppError(
      403,
      "Diese Mitgliedschaft kann nicht eingeschränkt werden.",
    );
  if (
    d.roleId &&
    !(
      await rows(
        db,
        "SELECT 1 FROM custom_roles WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, d.roleId],
      )
    ).length
  )
    throw new AppError(404, "Rolle nicht gefunden.");
  await db.query(
    "UPDATE memberships SET custom_role_id=$3 WHERE tenant_id=$1 AND user_id=$2",
    [ctx.tenantId, d.userId, d.roleId],
  );
  await audit(db, ctx, "role.assigned", d.userId);
  return { message: "Individuelle Rolle zugewiesen." };
}
