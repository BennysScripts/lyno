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
export async function readableArticles(db: DB, ctx: Context, search = "") {
  return rows(
    db,
    `SELECT a.*,c.name AS category_name,u.name AS author_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id AND c.tenant_id=a.tenant_id LEFT JOIN users u ON u.id=a.author_id WHERE a.tenant_id=$1 AND ($3::boolean OR a.visibility='company' OR (a.visibility='team' AND EXISTS(SELECT 1 FROM team_members tm WHERE tm.tenant_id=a.tenant_id AND tm.team_id=a.team_id AND tm.user_id=$2))) AND ($4='' OR a.title ILIKE '%'||$4||'%' OR a.body ILIKE '%'||$4||'%') ORDER BY a.updated_at DESC`,
    [ctx.tenantId, ctx.userId, canManage(ctx.role), search],
  );
}
export const articleSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(10).max(50000),
  categoryId: uuid.nullable().default(null),
  visibility: z.enum(["company", "managers", "team"]).default("company"),
  teamId: uuid.nullable().default(null),
});
export async function saveArticle(
  db: DB,
  ctx: Context,
  input: unknown,
  id?: string,
) {
  requireRole(ctx, ["owner", "admin", "manager"]);
  const a = articleSchema.parse(input);
  if (a.visibility === "team" && !a.teamId)
    throw new AppError(400, "Bitte wählen Sie ein Team.");
  if (
    a.categoryId &&
    !(
      await rows(db, "SELECT id FROM categories WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        a.categoryId,
      ])
    ).length
  )
    throw new AppError(404, "Kategorie nicht gefunden.");
  if (
    a.teamId &&
    !(
      await rows(db, "SELECT id FROM teams WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        a.teamId,
      ])
    ).length
  )
    throw new AppError(404, "Team nicht gefunden.");
  const params = [
    ctx.tenantId,
    a.title,
    a.body,
    a.categoryId,
    a.visibility,
    a.teamId,
    ctx.userId,
  ];
  let result;
  if (id) {
    [result] = await rows(
      db,
      "UPDATE articles SET title=$2,body=$3,category_id=$4,visibility=$5,team_id=$6,updated_at=now() WHERE tenant_id=$1 AND id=$7 RETURNING *",
      [...params.slice(0, 6), uuid.parse(id)],
    );
  } else
    [result] = await rows(
      db,
      "INSERT INTO articles(tenant_id,title,body,category_id,visibility,team_id,author_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      params,
    );
  if (!result) throw new AppError(404, "Artikel nicht gefunden.");
  await audit(db, ctx, id ? "article.updated" : "article.created", result.id);
  return result;
}
export async function checklistAction(db: DB, ctx: Context, input: unknown) {
  requireWrite(ctx);
  const d = z.object({ id: uuid, done: z.boolean() }).parse(input);
  const [item] = await rows(
    db,
    "SELECT * FROM checklist_items WHERE tenant_id=$1 AND id=$2",
    [ctx.tenantId, d.id],
  );
  if (!item) throw new AppError(404, "Eintrag nicht gefunden.");
  if (
    item.article_id &&
    !(await readableArticles(db, ctx)).some((a) => a.id === item.article_id)
  )
    throw new AppError(404, "Eintrag nicht gefunden.");
  if (d.done)
    await db.query(
      "INSERT INTO checklist_completions(tenant_id,item_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [ctx.tenantId, d.id, ctx.userId],
    );
  else
    await db.query(
      "DELETE FROM checklist_completions WHERE tenant_id=$1 AND item_id=$2 AND user_id=$3",
      [ctx.tenantId, d.id, ctx.userId],
    );
  return { ok: true };
}
