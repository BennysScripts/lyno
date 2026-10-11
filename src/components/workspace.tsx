"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { hasAccess } from "@/lib/access";
import type { AppData, Template } from "@/lib/types";
import { AppContext, type EditorTemplate } from "./app-context";
import { api, Badge, initials, Logo, roleLabel, ThemeToggle } from "./ui";
import { GlobalSearch } from "./workspace-search";
import { LearningView } from "./workspace-learning";
import type { ModuleId } from "@/lib/catalog";
import type { Permission } from "@/lib/customization";
import { Dashboard } from "./workspace-dashboard";
import { Flow, StartWorkflow, TemplateEditor } from "./workspace-flow";
import { Academy } from "./workspace-academy";
import { AssistView, InsightsView } from "./workspace-insights";
import {
  TeamView,
  SettingsView,
  AuditView,
  NotificationsView,
} from "./workspace-admin";
const nav = [
  { path: "", label: "Übersicht", icon: LayoutDashboard },
  { path: "flow", label: "Flow", icon: GitBranch },
  { path: "academy", label: "Academy", icon: BookOpen },
  { path: "assist", label: "Assist", icon: MessageSquare },
  { path: "insights", label: "Insights", icon: ChartNoAxesCombined },
];
const adminNav = [
  { path: "team", label: "Team & Rollen", icon: Users },
  { path: "audit", label: "Aktivitäten", icon: ShieldCheck },
  { path: "settings", label: "Einstellungen", icon: Settings2 },
];
export function Workspace({
  initial,
  view,
}: {
  initial: AppData;
  view: string;
}) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [start, setStart] = useState<Template | null>(null);
  const [editor, setEditor] = useState<EditorTemplate | null>(null);
  const router = useRouter();
  useEffect(() => setData(initial), [initial]);
  useEffect(() => setOpen(false), [view]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 6500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function toast(text: string, error = false) {
    setNotice({ text, error });
  }
  async function refresh() {
    const id =
      view === "flow"
        ? new URLSearchParams(window.location.search).get("id")
        : null;
    setData(
      await api<AppData>(
        id ? `state?workflowId=${encodeURIComponent(id)}` : "state",
      ),
    );
  }
  async function mutate<T = Record<string, unknown>>(
    path: string,
    body: unknown,
    method = "POST",
    message = "Gespeichert.",
  ) {
    const r = await api<T>(path, body, method);
    await refresh();
    if (message) toast(message);
    return r;
  }
  async function run(
    path: string,
    body: unknown,
    method = "POST",
    message = "Gespeichert.",
  ) {
    try {
      await mutate(path, body, method, message);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fehler beim Speichern.", true);
    }
  }
  const entitled = hasAccess(data.organization);
  const moduleView = view === "learning" ? "academy" : view;
  const viewPermission = (
    moduleView === "assist" ? "assist.use" : `${moduleView}.read`
  ) as Permission;
  const locked =
    ["flow", "academy", "assist", "insights"].includes(moduleView) &&
    (!data.access.modules.includes(moduleView as ModuleId) ||
      !data.permissions.includes(viewPermission));
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--brand-accent",
      data.settings.branding.accent,
    );
    return () => {
      document.documentElement.style.removeProperty("--brand-accent");
    };
  }, [data.settings.branding.accent]);
  const manage =
      ["owner", "admin", "manager"].includes(data.me.role) &&
      entitled &&
      (!moduleView ||
        !["flow", "academy"].includes(moduleView) ||
        data.permissions.includes(`${moduleView}.write` as Permission)),
    admin =
      ["owner", "admin"].includes(data.me.role) &&
      data.permissions.includes("core.manage"),
    write =
      data.me.role !== "viewer" &&
      entitled &&
      (!moduleView ||
        !["flow", "academy"].includes(moduleView) ||
        data.permissions.includes(`${moduleView}.write` as Permission));
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const label =
    [
      ...nav,
      ...adminNav,
      { path: "notifications", label: "Benachrichtigungen" },
    ].find((n) => n.path === view)?.label || "Übersicht";
  return (
    <AppContext
      value={{
        data,
        refresh,
        mutate,
        run,
        start: setStart,
        editTemplate: (t) =>
          setEditor(
            t || {
              name: "",
              description: "",
              fields: [],
              steps: [{ title: "", description: "", kind: "task", dueDays: 1 }],
              recurrenceDays: null,
            },
          ),
        toast,
        manage,
        admin,
        write,
      }}
    >
      <div className="app-shell">
        <aside className={`sidebar ${open ? "open" : ""}`}>
          {data.settings.branding.logo && (
            <img
              className="company-logo"
              src={data.settings.branding.logo}
              alt={`${data.organization.name} Logo`}
              width={32}
              height={32}
            />
          )}
          <Logo small />
          <button
            className="icon-button mobile-sidebar-close"
            aria-label="Navigation schließen"
            onClick={() => setOpen(false)}
          >
            <X size={19} />
          </button>
          <div className="workspace-switch">
            <span className="avatar">{initials(data.organization.name)}</span>
            <div>
              <label className="sr-only" htmlFor="workspace">
                Unternehmen wechseln
              </label>
              <select
                id="workspace"
                value={data.organization.id}
                onChange={async (e) => {
                  try {
                    await api("company/switch", { id: e.target.value });
                    router.refresh();
                    await refresh();
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                {data.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <small>Ihr gemeinsamer Arbeitsraum</small>
            </div>
          </div>
          <span className="nav-label">ARBEITSRAUM</span>
          <nav className="side-nav" aria-label="Arbeitsraum">
            {nav.map((n) => (
              <Link
                key={n.path}
                href={`/app${n.path ? "/" + n.path : ""}`}
                className={view === n.path ? "active" : ""}
                aria-current={view === n.path ? "page" : undefined}
              >
                <n.icon />
                {n.label}
                {n.path === "flow" &&
                  !!data.workflows.filter((w) => w.status === "active")
                    .length && (
                    <span className="nav-count">
                      {
                        data.workflows.filter((w) => w.status === "active")
                          .length
                      }
                    </span>
                  )}
              </Link>
            ))}
          </nav>
          <div className="nav-divider" />
          <span className="nav-label">UNTERNEHMEN</span>
          <nav className="side-nav" aria-label="Unternehmen">
            {adminNav
              .filter((n) => n.path !== "audit" || manage)
              .map((n) => (
                <Link
                  href={`/app/${n.path}`}
                  key={n.path}
                  className={view === n.path ? "active" : ""}
                  aria-current={view === n.path ? "page" : undefined}
                >
                  <n.icon />
                  {n.label}
                </Link>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="trial-card">
              <span>
                <MessageSquare size={13} /> Raum für gute Arbeit
              </span>
              <p>
                {data.organization.subscription_status === "trialing"
                  ? "Ihre 14-tägige Testphase ist aktiv. Entdecken Sie, was Ihr Team weiterbringt."
                  : "Alle Module. Ein gemeinsamer Arbeitsraum."}
              </p>
              <Link href="/app/settings?tab=billing">
                Paket ansehen <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="sidebar-user">
              <span className="avatar">{initials(data.me.name)}</span>
              <div>
                <strong>{data.me.name}</strong>
                <small>{roleLabel[data.me.role]}</small>
              </div>
              <button
                className="icon-button"
                aria-label="Abmelden"
                onClick={async () => {
                  try {
                    await api("auth/logout", {});
                    window.location.href = "/anmelden";
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="app-body">
          <header className="app-topbar">
            <button
              className="icon-button app-mobile-menu"
              aria-label="Navigation öffnen"
              onClick={() => setOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumbs">
              <span>Arbeitsraum</span>
              <ChevronRight size={12} />
              <strong>{label}</strong>
            </div>
            <GlobalSearch />
            <div className="topbar-actions">
              <Badge tone="green">
                <span className="live-dot" />
                {data.organization.is_demo
                  ? "Beispiel-Arbeitsraum"
                  : "Ihr Unternehmen"}
              </Badge>
              <ThemeToggle />
              <Link
                href="/app/notifications"
                className="icon-button"
                aria-label={`Benachrichtigungen, ${unread} ungelesen`}
              >
                <Bell size={17} />
                {!!unread && <i className="notification-dot" />}
              </Link>
              <Link
                href="/app/settings"
                className="avatar"
                aria-label="Profil öffnen"
              >
                {initials(data.me.name)}
              </Link>
            </div>
          </header>
          <main id="main" className="app-content">
            {data.organization.is_demo && (
              <div className="app-notice demo">
                <span>
                  Beispieldaten · Nordlicht Studio ist ein fiktives Unternehmen.
                  Kennzahlen basieren auf den gespeicherten Seed-Daten.
                </span>
              </div>
            )}
            {!data.me.verified && (
              <div className="app-notice">
                <span>
                  {data.mailMode === "smtp"
                    ? "Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link in Ihrer Nachricht."
                    : "Bitte bestätigen Sie Ihre E-Mail-Adresse. Im lokalen Testmodus liegt der Link im Dateipostfach."}
                </span>
                <button
                  onClick={() =>
                    run(
                      "auth/resend",
                      {},
                      "POST",
                      data.mailMode === "smtp"
                        ? "Nachricht für den Versand vorgemerkt."
                        : "Bestätigungslink im lokalen Postfach vorbereitet.",
                    )
                  }
                >
                  Link erneut vorbereiten
                </button>
              </div>
            )}
            {!entitled && (
              <div className="app-notice">
                <span>
                  Ihre Testphase oder Ihr Abo ist beendet. Ihre Daten bleiben
                  lesbar.
                </span>
                <Link href="/app/settings?tab=billing">Testabo verwalten</Link>
              </div>
            )}
            {locked ? (
              <section className="panel panel-pad">
                <h1>Dieser Bereich ist nicht freigeschaltet.</h1>
                <p>
                  Die gebuchten Module und Ihre Rolle bestimmen den Zugriff.
                </p>
                <Link className="button" href="/app/settings?tab=billing">
                  Paket und Module verwalten
                </Link>
              </section>
            ) : view === "" ? (
              <Dashboard />
            ) : view === "flow" ? (
              <Flow />
            ) : view === "academy" ? (
              <Academy />
            ) : view === "learning" ? (
              <LearningView />
            ) : view === "assist" ? (
              <AssistView />
            ) : view === "insights" ? (
              <InsightsView />
            ) : view === "team" ? (
              <TeamView />
            ) : view === "settings" ? (
              <SettingsView />
            ) : view === "audit" ? (
              <AuditView />
            ) : (
              <NotificationsView />
            )}
          </main>
        </div>
      </div>
      {start && (
        <StartWorkflow template={start} onClose={() => setStart(null)} />
      )}{" "}
      {editor && (
        <TemplateEditor template={editor} onClose={() => setEditor(null)} />
      )}{" "}
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`toast ${notice.error ? "error-toast" : ""}`}
        >
          {notice.text}
          <button
            aria-label="Hinweis schließen"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext>
  );
}
