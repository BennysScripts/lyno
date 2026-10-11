import { z } from "zod";
import { rows, type DB } from "./db";
import type { Context } from "./security";
import { entitlements } from "./entitlements";
import { permitted } from "./customization";
import { readableArticles } from "./academy";
import { readableDocuments } from "./learning";
export async function search(db: DB, ctx: Context, input: unknown) {
  const q = z.string().trim().min(2).max(120).parse(input),
    e = await entitlements(db, ctx.tenantId);
  const items: { id: string; title: string; kind: string; href: string }[] = [];
  if (e.modules.includes("flow") && permitted(ctx, "flow.read")) {
    const ws = await rows(
      db,
      "SELECT id,name FROM workflows WHERE tenant_id=$1 AND name ILIKE '%'||$2||'%' ORDER BY created_at DESC LIMIT 15",
      [ctx.tenantId, q],
    );
    items.push(
      ...ws.map((w) => ({
        id: w.id,
        title: w.name,
        kind: "Ablauf",
        href: `/app/flow?id=${w.id}`,
      })),
    );
    const tasks = await rows(
      db,
      "SELECT id,title,workflow_id FROM tasks WHERE tenant_id=$1 AND title ILIKE '%'||$2||'%' ORDER BY position LIMIT 15",
      [ctx.tenantId, q],
    );
    items.push(
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        kind: "Aufgabe",
        href: `/app/flow?id=${t.workflow_id}`,
      })),
    );
  }
  if (e.modules.includes("academy") && permitted(ctx, "academy.read")) {
    items.push(
      ...(await readableArticles(db, ctx, q)).slice(0, 15).map((a) => ({
        id: a.id,
        title: a.title,
        kind: "Artikel",
        href: `/app/academy?id=${a.id}`,
      })),
    );
    items.push(
      ...(await readableDocuments(db, ctx))
        .filter((d) => d.title.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 10)
        .map((d) => ({
          id: d.id,
          title: d.title,
          kind: "Dokument",
          href: `/api/documents/${d.id}`,
        })),
    );
  }
  const people = await rows(
    db,
    "SELECT u.id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND u.name ILIKE '%'||$2||'%' LIMIT 10",
    [ctx.tenantId, q],
  );
  items.push(
    ...people.map((p) => ({
      id: p.id,
      title: p.name,
      kind: "Team",
      href: "/app/team",
    })),
  );
  return { items };
}
