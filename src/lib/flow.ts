import { requireAutomation, requireEntitlement } from "./entitlements";
import { z } from "zod";
import { rows, type DB } from "./db";
import {
  AppError,
  audit,
  canManage,
  requireRole,
  requireWrite,
  uuid,
  type Context,
} from "./security";
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "number", "checkbox"]),
  required: z.boolean(),
  default: z
    .union([z.string().max(2000), z.number().finite(), z.boolean()])
    .optional(),
});
export const stepSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(3000).default(""),
  kind: z.enum(["task", "approval"]),
  dueDays: z.number().int().min(0).max(365).default(3),
  assigneeId: uuid.nullish(),
  articleId: uuid.nullish(),
  condition: z
    .object({
      field: z.string(),
      equals: z.union([z.string(), z.number(), z.boolean()]),
    })
    .optional(),
});
export const templateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().max(2000).default(""),
    steps: z.array(stepSchema).min(1).max(40),
    fields: z.array(fieldSchema).max(30).default([]),
    recurrenceDays: z.number().int().min(1).max(365).nullable().default(null),
  })
  .superRefine((t, c) => {
    const keys = t.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length)
      c.addIssue({
        code: "custom",
        message: "Formularschlüssel müssen eindeutig sein.",
      });
    for (const s of t.steps)
      if (s.condition && !keys.includes(s.condition.field))
        c.addIssue({
          code: "custom",
          message: "Eine Bedingung verweist auf ein unbekanntes Feld.",
        });
    if (
      t.recurrenceDays &&
      t.fields.some((f) => f.required && f.default === undefined)
    )
      c.addIssue({
        code: "custom",
        message:
          "Wiederkehrende Abläufe benötigen Standardwerte für alle Pflichtfelder.",
      });
  });
export type TemplateInput = z.infer<typeof templateSchema>;
export function validateForm(
  fields: z.infer<typeof fieldSchema>[],
  input: Record<string, unknown>,
) {
  const output: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const value = input[f.key] ?? f.default;
    if (value === undefined || value === null || value === "") {
      if (f.required)
        throw new AppError(400, `Bitte füllen Sie „${f.label}“ aus.`);
      continue;
    }
    if (f.type === "text" && (typeof value !== "string" || value.length > 2000))
      throw new AppError(400, `Ungültiger Text: ${f.label}`);
    if (
      f.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new AppError(400, `Ungültige Zahl: ${f.label}`);
    if (f.type === "checkbox" && typeof value !== "boolean")
      throw new AppError(400, `Ungültige Auswahl: ${f.label}`);
    output[f.key] = value as string | number | boolean;
  }
  return output;
}
export function stepEnabled(
  step: z.infer<typeof stepSchema>,
  form: Record<string, unknown>,
) {
  return (
    !step.condition || form[step.condition.field] === step.condition.equals
  );
}
async function checkLinks(db: DB, ctx: Context, t: TemplateInput) {
  for (const s of t.steps) {
    if (
      s.assigneeId &&
      !(
        await rows(
          db,
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role<>'viewer'",
          [ctx.tenantId, s.assigneeId],
        )
      ).length
    )
      throw new AppError(
        400,
        "Zuständige Person gehört nicht zum Unternehmen.",
      );
    if (
      s.articleId &&
      !(
        await rows(db, "SELECT 1 FROM articles WHERE tenant_id=$1 AND id=$2", [
          ctx.tenantId,
          s.articleId,
        ])
      ).length
    )
      throw new AppError(404, "Wissensartikel nicht gefunden.");
  }
}
export async function saveTemplate(
  db: DB,
  ctx: Context,
  input: unknown,
  id?: string,
) {
  requireRole(ctx, ["owner", "admin", "manager"]);
  const t = templateSchema.parse(input);
  await requireEntitlement(db, ctx.tenantId, "flow");
  if (t.recurrenceDays) await requireAutomation(db, ctx.tenantId, id);
  await checkLinks(db, ctx, t);
  let result;
  if (id) {
    [result] = await rows(
      db,
      `UPDATE templates SET name=$3,description=$4,steps=$5,fields=$6,recurrence_days=$7,next_run_at=CASE WHEN $7::integer IS NULL THEN NULL ELSE now()+$7*interval '1 day' END WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      [
        ctx.tenantId,
        uuid.parse(id),
        t.name,
        t.description,
        JSON.stringify(t.steps),
        JSON.stringify(t.fields),
        t.recurrenceDays,
      ],
    );
  } else {
    [result] = await rows(
      db,
      `INSERT INTO templates(tenant_id,name,description,steps,fields,recurrence_days,next_run_at,created_by) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $6::integer IS NULL THEN NULL ELSE now()+$6*interval '1 day' END,$7) RETURNING *`,
      [
        ctx.tenantId,
        t.name,
        t.description,
        JSON.stringify(t.steps),
        JSON.stringify(t.fields),
        t.recurrenceDays,
        ctx.userId,
      ],
    );
  }
  if (!result) throw new AppError(404, "Vorlage nicht gefunden.");
  await audit(db, ctx, id ? "template.updated" : "template.created", result.id);
  return result;
}
export const startSchema = z.object({
  templateId: uuid,
  name: z.string().trim().min(2).max(160),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueAt: z.string().datetime().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).default({}),
});
export async function startWorkflow(db: DB, ctx: Context, input: unknown) {
  requireWrite(ctx);
  const data = startSchema.parse(input);
  const [t] = await rows(
    db,
    "SELECT * FROM templates WHERE tenant_id=$1 AND id=$2 AND active=true",
    [ctx.tenantId, data.templateId],
  );
  if (!t) throw new AppError(404, "Vorlage nicht gefunden.");
  const def = templateSchema.parse({
    name: t.name,
    description: t.description,
    steps: t.steps,
    fields: t.fields,
    recurrenceDays: t.recurrence_days,
  });
  const form = validateForm(def.fields, data.formData);
  const [w] = await rows(
    db,
    "INSERT INTO workflows(tenant_id,template_id,name,priority,form_data,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [
      ctx.tenantId,
      t.id,
      data.name,
      data.priority,
      JSON.stringify(form),
      data.dueAt ?? null,
      ctx.userId,
    ],
  );
  let ready = false;
  for (const [i, s] of def.steps.entries()) {
    const enabled = stepEnabled(s, form);
    const status = !enabled ? "skipped" : !ready ? "ready" : "pending";
    if (enabled) ready = true;
    await db.query(
      "INSERT INTO tasks(tenant_id,workflow_id,title,description,position,kind,status,assignee_id,article_id,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+$10*interval '1 day')",
      [
        ctx.tenantId,
        w.id,
        s.title,
        s.description,
        i,
        s.kind,
        status,
        s.assigneeId ?? null,
        s.articleId ?? null,
        s.dueDays,
      ],
    );
  }
  if (!ready)
    await db.query(
      "UPDATE workflows SET status='completed',completed_at=now() WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, w.id],
    );
  await audit(db, ctx, "workflow.started", w.id, { name: w.name });
  return w;
}
export async function taskAction(
  db: DB,
  ctx: Context,
  id: string,
  input: unknown,
) {
  requireWrite(ctx);
  const data = z
    .object({
      action: z.enum(["complete", "reject", "assign"]),
      assigneeId: uuid.nullable().optional(),
    })
    .parse(input);
  const [initial] = await rows(
    db,
    "SELECT workflow_id FROM tasks WHERE tenant_id=$1 AND id=$2",
    [ctx.tenantId, uuid.parse(id)],
  );
  if (!initial) throw new AppError(404, "Aufgabe nicht gefunden.");
  const [w] = await rows(
    db,
    "SELECT * FROM workflows WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
    [ctx.tenantId, initial.workflow_id],
  );
  const [t] = await rows(
    db,
    "SELECT * FROM tasks WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
    [ctx.tenantId, id],
  );
  if (w.status !== "active")
    throw new AppError(409, "Der Ablauf ist bereits abgeschlossen.");
  if (data.action === "assign") {
    requireRole(ctx, ["owner", "admin", "manager"]);
    if (
      data.assigneeId &&
      !(
        await rows(
          db,
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role<>'viewer'",
          [ctx.tenantId, data.assigneeId],
        )
      ).length
    )
      throw new AppError(400, "Person nicht gefunden.");
    await db.query(
      "UPDATE tasks SET assignee_id=$3 WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, id, data.assigneeId ?? null],
    );
    if (data.assigneeId)
      await db.query(
        "INSERT INTO notifications(tenant_id,user_id,title,href) VALUES($1,$2,$3,$4)",
        [
          ctx.tenantId,
          data.assigneeId,
          `Neue Aufgabe: ${t.title}`,
          `/app/flow?id=${w.id}`,
        ],
      );
  } else {
    if (t.status !== "ready")
      throw new AppError(
        409,
        "Diese Aufgabe ist noch nicht bereit oder bereits erledigt.",
      );
    if (t.kind === "approval") requireRole(ctx, ["owner", "admin", "manager"]);
    if (t.assignee_id && t.assignee_id !== ctx.userId && !canManage(ctx.role))
      throw new AppError(
        403,
        "Diese Aufgabe ist einer anderen Person zugewiesen.",
      );
    if (data.action === "reject" && t.kind !== "approval")
      throw new AppError(400, "Nur Freigaben können abgelehnt werden.");
    await db.query(
      "UPDATE tasks SET status=$3,completed_at=now() WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, id, data.action === "reject" ? "rejected" : "done"],
    );
    if (data.action === "reject")
      await db.query(
        "UPDATE workflows SET status='canceled',completed_at=now() WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, w.id],
      );
    else {
      const [next] = await rows(
        db,
        "SELECT id FROM tasks WHERE tenant_id=$1 AND workflow_id=$2 AND status='pending' ORDER BY position LIMIT 1",
        [ctx.tenantId, w.id],
      );
      if (next)
        await db.query(
          "UPDATE tasks SET status='ready' WHERE tenant_id=$1 AND id=$2",
          [ctx.tenantId, next.id],
        );
      else
        await db.query(
          "UPDATE workflows SET status='completed',completed_at=now() WHERE tenant_id=$1 AND id=$2",
          [ctx.tenantId, w.id],
        );
    }
  }
  await audit(db, ctx, `task.${data.action}`, w.id, { task: t.title });
  return { ok: true };
}
export async function comment(db: DB, ctx: Context, input: unknown) {
  requireWrite(ctx);
  const data = z
    .object({ workflowId: uuid, body: z.string().trim().min(1).max(4000) })
    .parse(input);
  if (
    !(
      await rows(db, "SELECT id FROM workflows WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        data.workflowId,
      ])
    ).length
  )
    throw new AppError(404, "Ablauf nicht gefunden.");
  const [r] = await rows(
    db,
    "INSERT INTO comments(tenant_id,workflow_id,user_id,body) VALUES($1,$2,$3,$4) RETURNING *",
    [ctx.tenantId, data.workflowId, ctx.userId, data.body],
  );
  await audit(db, ctx, "comment.created", data.workflowId);
  return r;
}
