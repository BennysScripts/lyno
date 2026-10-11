import { campaignStatus } from "@/lib/discount";
import { catalog, type ModuleId } from "@/lib/catalog";
import {
  loadPermissions,
  requirePermission,
  saveSettings,
  savePreferences,
  customRole,
  assignRole,
  type Permission,
} from "@/lib/customization";
import {
  uploadDocument,
  readableDocuments,
  saveLearningPath,
  completeLearning,
} from "@/lib/learning";
import { search } from "@/lib/search";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  register,
  login,
  getContext,
  requestReset,
  resetPassword,
  verifyEmail,
  getIdentity,
} from "@/lib/auth";
import { query, transaction, rows } from "@/lib/db";
import {
  AppError,
  audit,
  checkOrigin,
  secureCookies,
  requireRole,
  uuid,
  hash,
  token,
  appUrl,
  rateLimit,
} from "@/lib/security";
import { state, exportData } from "@/lib/state";
import { saveTemplate, startWorkflow, taskAction, comment } from "@/lib/flow";
import { saveArticle, checklistAction, readableArticles } from "@/lib/academy";
import {
  invite,
  acceptInvite,
  changeMember,
  teamAction,
  deleteAccount,
  deleteCompany,
  bootstrap,
} from "@/lib/core";
import { assist } from "@/lib/assist";
import { subscription, stripeWebhook } from "@/lib/billing";
import { insights } from "@/lib/insights";
import { joinWaitlist, confirmWaitlist, contact } from "@/lib/public";
import { sendMail } from "@/lib/mail";
import { requireEntitlement } from "@/lib/entitlements";
import { workflowList } from "@/lib/workflow-list";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    const method = req.method;
    if (path !== "billing/webhook") checkOrigin(req);
    if (method === "GET" && path === "health") {
      await query("SELECT 1");
      return NextResponse.json({ status: "ok", billing: "test" });
    }
    if (method === "GET" && path === "catalog")
      return NextResponse.json(
        await transaction(async (db) => ({
          ...catalog(),
          campaign: await campaignStatus(db),
        })),
        { headers: { "Cache-Control": "no-store" } },
      );
    let body: unknown = {};
    if (method !== "GET") {
      const raw = await req.text();
      if (
        Buffer.byteLength(raw) >
        (path === "documents"
          ? 2900000
          : path === "customization"
            ? 360000
            : 100000)
      )
        throw new AppError(413, "Die Anfrage ist zu groß.");
      if (path === "billing/webhook")
        return NextResponse.json(
          await stripeWebhook(raw, req.headers.get("stripe-signature") || ""),
        );
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        throw new AppError(400, "Ungültiges JSON.");
      }
    }
    const cookieOptions = {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    };
    if (method === "POST" && ["auth/register", "auth/login"].includes(path)) {
      // Per-identity limits are persistent. Do not trust an arbitrary X-Forwarded-For header.
      const r =
        path === "auth/register" ? await register(body) : await login(body);
      const response = NextResponse.json({ ok: true });
      response.cookies.set("lyno_session", r.session, cookieOptions);
      return response;
    }
    if (method === "POST" && path === "auth/forgot")
      return NextResponse.json(await requestReset(body));
    if (method === "POST" && path === "auth/reset")
      return NextResponse.json(await resetPassword(body));
    if (method === "POST" && path === "auth/verify") {
      const d = z.object({ token: z.string().length(64) }).parse(body);
      return NextResponse.json(await verifyEmail(d.token));
    }
    if (method === "POST" && path === "waitlist")
      return NextResponse.json(await joinWaitlist(body));
    if (method === "POST" && path === "waitlist/confirm") {
      const d = z.object({ token: z.string().length(64) }).parse(body);
      return NextResponse.json(await confirmWaitlist(d.token));
    }
    if (method === "POST" && path === "contact")
      return NextResponse.json(await contact(body));
    if (method === "POST" && path === "company/onboard") {
      const identity = await getIdentity(
        req.cookies.get("lyno_session")?.value,
      );
      const { name } = z
        .object({ name: z.string().trim().min(2).max(120) })
        .parse(body);
      await rateLimit(`companies:${identity.userId}`, 5, 86400);
      await transaction(async (db) => {
        const [org] = await rows(
          db,
          "INSERT INTO organizations(name) VALUES($1) RETURNING id",
          [name],
        );
        await db.query(
          "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
          [org.id, identity.userId],
        );
        await db.query("SELECT set_config('app.tenant_id',$1,true)", [org.id]);
        await bootstrap(db, { ...identity, tenantId: org.id, role: "owner" });
        await db.query("UPDATE sessions SET tenant_id=$1 WHERE id_hash=$2", [
          org.id,
          identity.sessionHash,
        ]);
      });
      return NextResponse.json({ ok: true });
    }
    if (method === "POST" && path === "account/delete") {
      const identity = await getIdentity(
        req.cookies.get("lyno_session")?.value,
      );
      const result = await deleteAccount(
        { ...identity, tenantId: "", role: "viewer" },
        body,
      );
      const r = NextResponse.json(result);
      r.cookies.set("lyno_session", "", { ...cookieOptions, maxAge: 0 });
      return r;
    }
    if (method === "POST" && path === "invitations/accept") {
      const identity = await getIdentity(
        req.cookies.get("lyno_session")?.value,
      );
      return NextResponse.json(
        await acceptInvite({ ...identity, tenantId: "", role: "viewer" }, body),
      );
    }
    const ctx = await getContext(req.cookies.get("lyno_session")?.value);
    if (method === "POST" && path === "auth/logout") {
      await query("DELETE FROM sessions WHERE id_hash=$1", [ctx.sessionHash]);
      const r = NextResponse.json({ ok: true });
      r.cookies.set("lyno_session", "", { ...cookieOptions, maxAge: 0 });
      return r;
    }
    if (method === "POST" && path === "auth/resend") {
      await rateLimit(`resend:${ctx.userId}`, 3, 3600);
      const raw = token();
      await query(
        "INSERT INTO auth_tokens(id_hash,user_id,purpose,expires_at) VALUES($1,$2,'verify',now()+interval '2 days')",
        [hash(raw), ctx.userId],
      );
      await sendMail(
        ctx.email,
        "LYNO: E-Mail bestätigen",
        `${appUrl()}/bestaetigen?type=verify&token=${raw}`,
      );
      return NextResponse.json({
        message:
          process.env.MAIL_MODE === "smtp"
            ? "Nachricht für den Versand vorgemerkt."
            : "Bestätigung im lokalen Postfach vorbereitet.",
      });
    }
    const result = await transaction(async (db) => {
      // Resolve current permissions for every operation; no role is trusted from a cookie.
      const [member] = await rows(
        db,
        "SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2",
        [ctx.tenantId, ctx.userId],
      );
      if (!member) throw new AppError(401, "Mitgliedschaft nicht mehr gültig.");
      ctx.role = member.role;
      await loadPermissions(db, ctx);
      const root = path.split("/")[0];
      const moduleMap: Record<string, ModuleId> = {
        templates: "flow",
        workflows: "flow",
        tasks: "flow",
        comments: "flow",
        articles: "academy",
        categories: "academy",
        checklist: "academy",
        documents: "academy",
        learning: "academy",
        assist: "assist",
        insights: "insights",
      };
      const module = moduleMap[root];
      if (module) {
        await requireEntitlement(db, ctx.tenantId, module, method !== "GET");
        const permission: Permission =
          module === "assist"
            ? "assist.use"
            : module === "insights"
              ? "insights.read"
              : `${module}.${method === "GET" || path === "learning/complete" || path === "checklist/toggle" ? "read" : "write"}`;
        requirePermission(ctx, permission);
      }
      if (
        ["members", "invitations", "teams", "customization", "roles"].includes(
          root,
        ) ||
        path === "company"
      )
        requirePermission(ctx, "core.manage");
      if (method === "GET") {
        if (path === "search")
          return search(db, ctx, req.nextUrl.searchParams.get("q"));
        if (root === "documents" && path.split("/")[1]) {
          const [doc] = await readableDocuments(
            db,
            ctx,
            uuid.parse(path.split("/")[1]),
            true,
          );
          if (!doc) throw new AppError(404, "Dokument nicht gefunden.");
          await audit(db, ctx, "document.downloaded", doc.id);
          return new NextResponse(new Uint8Array(doc.bytes), {
            headers: {
              "Content-Type": doc.mime,
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
              "Content-Security-Policy": "sandbox; default-src 'none'",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "no-store",
            },
          });
        }
        if (path === "state")
          return state(
            db,
            ctx,
            req.nextUrl.searchParams.get("workflowId") || undefined,
          );
        if (path === "workflows")
          return workflowList(
            db,
            ctx,
            Object.fromEntries(req.nextUrl.searchParams),
          );
        if (path === "insights/report") {
          const days = z.coerce
            .number()
            .int()
            .min(7)
            .max(365)
            .parse(req.nextUrl.searchParams.get("days") || 30);
          const report = await insights(db, ctx, days);
          const cell = (value: unknown) => {
            const text = String(value ?? "");
            const escaped = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
            return `"${escaped.replace(/"/g, '""')}"`;
          };
          const lines = [
            ["Prozess", "Gestartet", "Abgeschlossen", "Durchschnitt Stunden"],
            ...report.processes.map((p) => [
              p.name,
              p.total,
              p.completed,
              p.avg_hours,
            ]),
          ];
          await audit(db, ctx, "insights.exported", ctx.tenantId, { days });
          return new NextResponse(
            "\uFEFF" + lines.map((row) => row.map(cell).join(";")).join("\r\n"),
            {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="lyno-bericht-${days}-tage.csv"`,
                "Cache-Control": "no-store",
              },
            },
          );
        }
        if (path === "insights")
          return insights(
            db,
            ctx,
            z.coerce
              .number()
              .int()
              .min(7)
              .max(365)
              .parse(req.nextUrl.searchParams.get("days") || 30),
          );
        if (path === "export") {
          requireRole(ctx, ["owner"]);
          await audit(db, ctx, "data.exported", ctx.tenantId);
          return exportData(db, ctx);
        }
        if (path.startsWith("articles/")) {
          const id = uuid.parse(path.split("/")[1]);
          const a = (await readableArticles(db, ctx)).find((a) => a.id === id);
          if (!a) throw new AppError(404, "Artikel nicht gefunden.");
          return a;
        }
      }
      if (
        method !== "GET" &&
        [
          "templates",
          "workflows",
          "tasks",
          "comments",
          "articles",
          "categories",
          "checklist",
          "assist",
        ].includes(path.split("/")[0])
      )
        await requireEntitlement(db, ctx.tenantId);
      if (method === "POST") {
        if (path === "customization") return saveSettings(db, ctx, body);
        if (path === "preferences") return savePreferences(db, ctx, body);
        if (path === "roles") return customRole(db, ctx, body);
        if (path === "roles/assign") return assignRole(db, ctx, body);
        if (path === "documents") return uploadDocument(db, ctx, body);
        if (path === "learning") return saveLearningPath(db, ctx, body);
        if (path === "learning/complete" || path === "checklist/toggle")
          return completeLearning(db, ctx, body);
        if (path === "templates") return saveTemplate(db, ctx, body);
        if (path === "workflows") return startWorkflow(db, ctx, body);
        if (path === "comments") return comment(db, ctx, body);
        if (path === "articles") return saveArticle(db, ctx, body);
        if (path === "checklist/toggle") return checklistAction(db, ctx, body);
        if (path === "invitations") return invite(db, ctx, body);
        if (path === "teams") return teamAction(db, ctx, body);
        if (path === "assist") {
          await rateLimit(`assist:${ctx.userId}`, 15, 60);
          return assist(db, ctx, body);
        }
        if (path === "billing") return subscription(db, ctx, body);
        if (path === "company/delete") return deleteCompany(db, ctx, body);
        if (path === "company/switch") {
          const { id } = z.object({ id: uuid }).parse(body);
          if (
            !(
              await rows(
                db,
                "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2",
                [id, ctx.userId],
              )
            ).length
          )
            throw new AppError(404, "Unternehmen nicht gefunden.");
          await db.query("UPDATE sessions SET tenant_id=$1 WHERE id_hash=$2", [
            id,
            ctx.sessionHash,
          ]);
          return { ok: true };
        }
        if (path === "company/create") {
          const { name } = z
            .object({ name: z.string().trim().min(2).max(120) })
            .parse(body);
          await rateLimit(`companies:${ctx.userId}`, 5, 86400);
          const [org] = await rows(
            db,
            "INSERT INTO organizations(name) VALUES($1) RETURNING id",
            [name],
          );
          await db.query(
            "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
            [org.id, ctx.userId],
          );
          await db.query("SELECT set_config('app.tenant_id',$1,true)", [
            org.id,
          ]);
          await bootstrap(db, { ...ctx, tenantId: org.id, role: "owner" });
          await db.query("UPDATE sessions SET tenant_id=$1 WHERE id_hash=$2", [
            org.id,
            ctx.sessionHash,
          ]);
          return { ok: true };
        }
        if (path === "categories") {
          requireRole(ctx, ["owner", "admin", "manager"]);
          const { name } = z
            .object({ name: z.string().trim().min(2).max(80) })
            .parse(body);
          return (
            await rows(
              db,
              "INSERT INTO categories(tenant_id,name) VALUES($1,$2) RETURNING *",
              [ctx.tenantId, name],
            )
          )[0];
        }
        if (path === "checklist") {
          requireRole(ctx, ["owner", "admin", "manager"]);
          const d = z
            .object({
              title: z.string().trim().min(2).max(160),
              articleId: uuid.nullable().default(null),
              templateId: uuid.nullable().default(null),
            })
            .parse(body);
          if (
            d.articleId &&
            !(await readableArticles(db, ctx)).some((a) => a.id === d.articleId)
          )
            throw new AppError(404, "Artikel nicht gefunden.");
          if (
            d.templateId &&
            !(
              await rows(
                db,
                "SELECT 1 FROM templates WHERE tenant_id=$1 AND id=$2",
                [ctx.tenantId, d.templateId],
              )
            ).length
          )
            throw new AppError(404, "Vorlage nicht gefunden.");
          return (
            await rows(
              db,
              "INSERT INTO checklist_items(tenant_id,title,article_id,template_id) VALUES($1,$2,$3,$4) RETURNING *",
              [ctx.tenantId, d.title, d.articleId, d.templateId],
            )
          )[0];
        }
        if (path === "notifications/read") {
          await db.query(
            "UPDATE notifications SET read_at=now() WHERE tenant_id=$1 AND user_id=$2",
            [ctx.tenantId, ctx.userId],
          );
          return { ok: true };
        }
      }
      if (method === "PATCH") {
        const [resource, id] = path.split("/");
        if (resource === "tasks") return taskAction(db, ctx, id, body);
        if (resource === "templates")
          return saveTemplate(db, ctx, body, uuid.parse(id));
        if (resource === "articles")
          return saveArticle(db, ctx, body, uuid.parse(id));
        if (resource === "members") return changeMember(db, ctx, id, body);
        if (resource === "invitations") {
          requireRole(ctx, ["owner", "admin"]);
          const [i] = await rows(
            db,
            "UPDATE invitations SET expires_at=now() WHERE tenant_id=$1 AND id=$2 AND accepted_at IS NULL RETURNING id",
            [ctx.tenantId, uuid.parse(id)],
          );
          if (!i) throw new AppError(404, "Einladung nicht gefunden.");
          await audit(db, ctx, "invitation.revoked", id);
          return { ok: true };
        }
        if (path === "profile") {
          const { name } = z
            .object({ name: z.string().trim().min(2).max(100) })
            .parse(body);
          await db.query("UPDATE users SET name=$1 WHERE id=$2", [
            name,
            ctx.userId,
          ]);
          await audit(db, ctx, "profile.updated", ctx.userId);
          return { ok: true };
        }
        if (path === "company") {
          requireRole(ctx, ["owner", "admin"]);
          const d = z
            .object({
              name: z.string().trim().min(2).max(120),
              industry: z.string().min(2).max(120),
              size: z.string().min(1).max(30),
            })
            .parse(body);
          await db.query(
            "UPDATE organizations SET name=$2,industry=$3,size=$4 WHERE id=$1",
            [ctx.tenantId, d.name, d.industry, d.size],
          );
          await audit(db, ctx, "organization.updated", ctx.tenantId);
          return { ok: true };
        }
        if (resource === "workflows") {
          requireRole(ctx, ["owner", "admin", "manager"]);
          const d = z
            .object({
              priority: z.enum(["low", "normal", "high", "urgent"]),
              dueAt: z.string().datetime().nullable(),
              status: z.enum(["active", "canceled"]).optional(),
            })
            .parse(body);
          const [w] = await rows(
            db,
            "UPDATE workflows SET priority=$3,due_at=$4,status=coalesce($5,status) WHERE tenant_id=$1 AND id=$2 AND status='active' RETURNING id",
            [
              ctx.tenantId,
              uuid.parse(id),
              d.priority,
              d.dueAt,
              d.status ?? null,
            ],
          );
          if (!w) throw new AppError(404, "Aktiver Ablauf nicht gefunden.");
          await audit(db, ctx, "workflow.updated", id, d);
          return { ok: true };
        }
      }
      throw new AppError(404, "Diese Funktion wurde nicht gefunden.");
    }, ctx.tenantId);
    if (result instanceof NextResponse) return result;
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
    if (path === "export")
      response.headers.set(
        "Content-Disposition",
        'attachment; filename="lyno-export.json"',
      );
    return response;
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json(
        { error: "Dieser Eintrag existiert bereits." },
        { status: 409 },
      );
    if (code === "23503" || code === "23514")
      return NextResponse.json(
        {
          error:
            "Die Angaben sind nicht gültig oder verweisen auf nicht verfügbare Daten.",
        },
        { status: 400 },
      );
    console.error("LYNO API error", {
      type: error instanceof Error ? error.name : "unknown",
      code: code ?? "none",
    });
    return NextResponse.json(
      {
        error:
          "Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
      },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH };
