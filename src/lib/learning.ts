import { z } from "zod";
import { rows, type DB } from "./db";
import {
  AppError,
  audit,
  canManage,
  requireRole,
  uuid,
  type Context,
} from "./security";
import { readableArticles, saveArticle } from "./academy";
import { requireEntitlement } from "./entitlements";
import { requirePermission } from "./customization";
export async function readableDocuments(
  db: DB,
  ctx: Context,
  id?: string,
  download = false,
) {
  return rows(
    db,
    `SELECT d.id,d.title,d.filename,d.mime,d.size_bytes,d.visibility,d.team_id,d.article_id,d.created_at${download ? ",d.bytes" : ""} FROM documents d WHERE d.tenant_id=$1 AND ($4::uuid IS NULL OR d.id=$4) AND ($3 OR d.visibility='company' OR (d.visibility='team' AND EXISTS(SELECT 1 FROM team_members tm WHERE tm.tenant_id=d.tenant_id AND tm.team_id=d.team_id AND tm.user_id=$2))) ORDER BY d.created_at DESC`,
    [ctx.tenantId, ctx.userId, canManage(ctx.role), id || null],
  );
}
export async function uploadDocument(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin", "manager"]);
  requirePermission(ctx, "academy.write");
  const { plan } = await requireEntitlement(db, ctx.tenantId, "academy");
  const d = z
    .object({
      title: z.string().trim().min(2).max(160),
      filename: z
        .string()
        .trim()
        .min(1)
        .max(150)
        .refine((v) => !/[\x00-\x1f/\\]/.test(v)),
      mime: z.enum(["application/pdf", "text/plain", "text/markdown"]),
      base64: z
        .string()
        .max(2800000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      visibility: z.enum(["company", "managers", "team"]),
      teamId: uuid.nullable().default(null),
    })
    .parse(input);
  const bytes = Buffer.from(d.base64, "base64");
  if (bytes.length > 2 * 1024 * 1024 || bytes.length === 0)
    throw new AppError(
      413,
      "Dokumente müssen zwischen 1 Byte und 2 MB groß sein.",
    );
  if (d.mime === "application/pdf" && bytes.toString("ascii", 0, 5) !== "%PDF-")
    throw new AppError(400, "Die Datei ist kein PDF.");
  if (
    d.mime !== "application/pdf" &&
    (bytes.includes(0) || !Buffer.from(bytes.toString("utf8")).equals(bytes))
  )
    throw new AppError(400, "Textdateien müssen gültiges UTF-8 enthalten.");
  if (d.visibility === "team" && !d.teamId)
    throw new AppError(400, "Bitte ein Team auswählen.");
  if (
    d.teamId &&
    !(
      await rows(db, "SELECT 1 FROM teams WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        d.teamId,
      ])
    ).length
  )
    throw new AppError(404, "Team nicht gefunden.");
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.tenantId,
  ]);
  const [used] = await rows(
    db,
    "SELECT coalesce(sum(size_bytes),0)::int AS n FROM documents WHERE tenant_id=$1",
    [ctx.tenantId],
  );
  if (used.n + bytes.length > plan.documentMB * 1024 * 1024)
    throw new AppError(
      409,
      `Das Dokumentlimit von ${plan.documentMB} MB ist erreicht.`,
    );
  // Plain text becomes a normal permission-filtered article and can be cited by Assist. PDFs remain downloads.
  const article =
    d.mime !== "application/pdf" &&
    bytes.toString("utf8").trim().length >= 10 &&
    bytes.length <= 50000
      ? await saveArticle(db, ctx, {
          title: d.title,
          body: bytes.toString("utf8"),
          visibility: d.visibility,
          teamId: d.teamId,
          categoryId: null,
        })
      : null;
  const [doc] = await rows(
    db,
    "INSERT INTO documents(tenant_id,title,filename,mime,bytes,size_bytes,visibility,team_id,uploaded_by,article_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    [
      ctx.tenantId,
      d.title,
      d.filename,
      d.mime,
      bytes,
      bytes.length,
      d.visibility,
      d.teamId,
      ctx.userId,
      article?.id || null,
    ],
  );
  await audit(db, ctx, "document.uploaded", doc.id);
  return { id: doc.id, message: "Dokument gespeichert." };
}
export async function learningPaths(db: DB, ctx: Context) {
  const articles = await readableArticles(db, ctx),
    ids = new Set(articles.map((a) => a.id));
  const paths = await rows<{
    id: string;
    title: string;
    description: string;
    article_ids: string[];
  }>(
    db,
    "SELECT * FROM learning_paths WHERE tenant_id=$1 ORDER BY created_at",
    [ctx.tenantId],
  );
  const progress = await rows(
    db,
    "SELECT path_id,article_id,completed_at FROM learning_progress WHERE tenant_id=$1 AND user_id=$2",
    [ctx.tenantId, ctx.userId],
  );
  // A path is visible only when every required source is accessible. No titles of restricted steps leak.
  return paths
    .filter((p) => p.article_ids.every((id: string) => ids.has(id)))
    .map((p) => ({
      ...p,
      completedIds: progress
        .filter(
          (r) => r.path_id === p.id && p.article_ids.includes(r.article_id),
        )
        .map((r) => r.article_id),
    }));
}
export async function saveLearningPath(db: DB, ctx: Context, input: unknown) {
  requireRole(ctx, ["owner", "admin", "manager"]);
  requirePermission(ctx, "academy.write");
  await requireEntitlement(db, ctx.tenantId, "academy");
  const d = z
    .object({
      id: uuid.optional(),
      title: z.string().trim().min(2).max(120),
      description: z.string().max(1000).default(""),
      confirmProgressReset: z.boolean().default(false),
      articleIds: z
        .array(uuid)
        .min(1)
        .max(40)
        .refine((v) => new Set(v).size === v.length),
    })
    .parse(input);
  const allowed = new Set((await readableArticles(db, ctx)).map((a) => a.id));
  if (d.articleIds.some((id) => !allowed.has(id)))
    throw new AppError(404, "Ein Artikel ist nicht zugänglich.");
  let progressReset = false;
  if (d.id) {
    const [previous] = await rows(
      db,
      "SELECT article_ids FROM learning_paths WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [ctx.tenantId, d.id],
    );
    if (!previous) throw new AppError(404, "Lernpfad nicht gefunden.");
    const old = previous.article_ids as string[];
    if (JSON.stringify(old) !== JSON.stringify(d.articleIds)) {
      if (!d.confirmProgressReset)
        throw new AppError(
          409,
          "Bitte bestätigen Sie die Anpassung des Lernfortschritts bei geänderter Schrittfolge.",
        );
      let prefix = 0;
      while (
        prefix < old.length &&
        prefix < d.articleIds.length &&
        old[prefix] === d.articleIds[prefix]
      )
        prefix++;
      await db.query(
        "DELETE FROM learning_progress WHERE tenant_id=$1 AND path_id=$2 AND NOT(article_id=ANY($3::uuid[]))",
        [ctx.tenantId, d.id, old.slice(0, prefix)],
      );
      progressReset = true;
    }
  }
  const [path] = d.id
    ? await rows(
        db,
        "UPDATE learning_paths SET title=$3,description=$4,article_ids=$5 WHERE tenant_id=$1 AND id=$2 RETURNING id",
        [ctx.tenantId, d.id, d.title, d.description, d.articleIds],
      )
    : await rows(
        db,
        "INSERT INTO learning_paths(tenant_id,title,description,article_ids) VALUES($1,$2,$3,$4) RETURNING id",
        [ctx.tenantId, d.title, d.description, d.articleIds],
      );
  if (!path) throw new AppError(404, "Lernpfad nicht gefunden.");
  await audit(db, ctx, "learning_path.saved", path.id, { progressReset });
  return path;
}
export async function completeLearning(db: DB, ctx: Context, input: unknown) {
  requirePermission(ctx, "academy.read");
  await requireEntitlement(db, ctx.tenantId, "academy");
  const d = z
    .object({ pathId: uuid, articleId: uuid, complete: z.boolean() })
    .parse(input);
  await db.query(
    "SELECT id FROM learning_paths WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
    [ctx.tenantId, d.pathId],
  );
  const path = (await learningPaths(db, ctx)).find((p) => p.id === d.pathId);
  if (!path || !path.article_ids.includes(d.articleId))
    throw new AppError(404, "Lernschritt nicht gefunden.");
  const index = path.article_ids.indexOf(d.articleId);
  if (
    d.complete &&
    path.article_ids
      .slice(0, index)
      .some((id: string) => !path.completedIds.includes(id))
  )
    throw new AppError(
      409,
      "Bitte schließen Sie zuerst die vorherigen Schritte ab.",
    );
  if (d.complete)
    await db.query(
      "INSERT INTO learning_progress(tenant_id,path_id,user_id,article_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [ctx.tenantId, d.pathId, ctx.userId, d.articleId],
    );
  else
    await db.query(
      "DELETE FROM learning_progress WHERE tenant_id=$1 AND path_id=$2 AND user_id=$3 AND article_id=ANY($4::uuid[])",
      [ctx.tenantId, d.pathId, ctx.userId, path.article_ids.slice(index)],
    );
  await audit(db, ctx, "learning.completed", d.pathId, {
    complete: d.complete,
  });
  return { message: "Lernfortschritt gespeichert." };
}
