"use client";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  GitBranch,
  Layers3,
  Plus,
} from "lucide-react";
import { useApp } from "./app-context";
import { Badge, Button, date, Empty, initials, statusLabel } from "./ui";
import type { Workflow, Task } from "@/lib/types";
export const actionLabel: Record<string, string> = {
  "workflow.started": "hat einen Ablauf gestartet",
  "task.complete": "hat eine Aufgabe abgeschlossen",
  "task.reject": "hat eine Freigabe abgelehnt",
  "task.assign": "hat eine Aufgabe zugewiesen",
  "article.created": "hat Wissen geteilt",
  "article.updated": "hat einen Artikel aktualisiert",
  "template.created": "hat eine Vorlage erstellt",
  "template.updated": "hat eine Vorlage bearbeitet",
  "organization.created": "hat den Arbeitsraum eingerichtet",
  "invitation.created": "hat eine Einladung vorbereitet",
  "invitation.accepted": "ist dem Unternehmen beigetreten",
  "comment.created": "hat einen Kommentar ergänzt",
  "profile.updated": "hat das Profil aktualisiert",
  "organization.updated": "hat die Firmeneinstellungen aktualisiert",
  "assist.used": "hat Assist verwendet",
  "team.saved": "hat ein Team aktualisiert",
  "member.role_changed": "hat eine Rolle geändert",
  "data.exported": "hat Unternehmensdaten exportiert",
  "billing.test_subscribe": "hat ein Testabo aktiviert",
  "billing.test_cancel": "hat ein Testabo gekündigt",
};
export function Stats({
  insights,
}: {
  insights: ReturnType<typeof useApp>["data"]["insights"];
}) {
  const s = insights.summary;
  return (
    <div className="stat-grid">
      {[
        {
          label: "Aktive Abläufe",
          value: s.active,
          icon: GitBranch,
          note: `Im Zeitraum von ${insights.days} Tagen gestartet`,
        },
        {
          label: "Abgeschlossene Abläufe",
          value: s.completed,
          icon: CircleCheck,
          note: `In den letzten ${insights.days} Tagen`,
          highlight: true,
        },
        {
          label: "Ø Bearbeitungszeit",
          value:
            s.avg_hours === null
              ? "—"
              : Number(s.avg_hours).toLocaleString("de-DE"),
          unit: s.avg_hours === null ? "" : "Std.",
          icon: Clock3,
          note: "Abgeschlossene Abläufe",
        },
        {
          label: "Überfällige Aufgaben",
          value: s.overdue,
          icon: Layers3,
          note: s.overdue
            ? "Hier braucht es Aufmerksamkeit"
            : "Alles im Zeitplan",
        },
      ].map((c) => (
        <div
          className={`stat-card ${c.highlight ? "highlight" : ""}`}
          key={c.label}
        >
          <div className="stat-label">
            {c.label}
            <c.icon />
          </div>
          <div className="stat-value">
            {c.value}
            <span>{c.unit}</span>
          </div>
          <small>
            {c.highlight && <ArrowDownRight size={11} />} {c.note}
          </small>
        </div>
      ))}
    </div>
  );
}
export function WorkflowTable({
  workflows,
  tasks: providedTasks,
}: {
  workflows: Workflow[];
  tasks?: Task[];
}) {
  const { data } = useApp();
  return workflows.length ? (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Datentabelle, horizontal scrollbar"
    >
      <table>
        <thead>
          <tr>
            <th>ABLAUF</th>
            <th>STATUS</th>
            <th>FORTSCHRITT</th>
            <th>FRIST</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((w) => {
            const tasks = (providedTasks || data.tasks).filter(
              (t) => t.workflow_id === w.id && t.status !== "skipped",
            );
            const done = tasks.filter((t) => t.status === "done").length;
            return (
              <tr key={w.id}>
                <td>
                  <Link className="row-button" href={`/app/flow?id=${w.id}`}>
                    <span className="template-icon">
                      <GitBranch size={15} />
                    </span>
                    <div>
                      <strong>{w.name}</strong>
                      <small>
                        {data.templates.find((t) => t.id === w.template_id)
                          ?.name || "Eigener Ablauf"}
                      </small>
                    </div>
                  </Link>
                </td>
                <td>
                  <Badge
                    tone={
                      w.status === "completed"
                        ? "green"
                        : w.status === "active"
                          ? "orange"
                          : "red"
                    }
                  >
                    {statusLabel[w.status]}
                  </Badge>
                </td>
                <td>
                  <span className="progress-mini">
                    <i
                      style={{
                        width: `${tasks.length ? (done / tasks.length) * 100 : 100}%`,
                      }}
                    />
                  </span>
                  <span className="progress-label">
                    {done}/{tasks.length}
                  </span>
                </td>
                <td>
                  <span className="muted">{date(w.due_at)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="Platz für Ihren ersten Ablauf">
      Starten Sie eine Vorlage und bringen Sie Ihre Prozesse in Bewegung.
    </Empty>
  );
}
export function Dashboard() {
  const { data, start, write } = useApp();
  const widgets = data.settings.dashboard.widgets;
  const mine = data.tasks
    .filter(
      (t) =>
        t.status === "ready" &&
        (!t.assignee_id || t.assignee_id === data.me.id) &&
        data.workflows.some(
          (w) => w.id === t.workflow_id && w.status === "active",
        ),
    )
    .slice(0, 6);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {new Date(data.now).toLocaleDateString("de-DE", {
              timeZone: "Europe/Berlin",
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <h1>Guten Tag, {data.me.name.split(" ")[0]}.</h1>
          <p>{data.settings.branding.tagline}</p>
        </div>
        {write &&
          data.templates.length > 0 &&
          data.permissions.includes("flow.write") && (
            <Button onClick={() => start(data.templates[0])}>
              Ablauf starten <Plus size={14} />
            </Button>
          )}
      </div>
      {widgets.includes("stats") && <Stats insights={data.insights} />}
      <div className="overview-grid">
        {widgets.includes("tasks") && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Ihre nächsten Schritte</h2>
                <p>Bereite Aufgaben, nach Priorität Ihres Teams</p>
              </div>
              <Badge>{mine.length} offen</Badge>
            </div>
            {mine.length ? (
              <div className="task-list">
                {mine.map((t) => (
                  <div className="task-list-item" key={t.id}>
                    <Link
                      className="task-circle"
                      href={`/app/flow?id=${t.workflow_id}`}
                      aria-label={`${t.title} öffnen`}
                    >
                      <ArrowUpRight size={12} />
                    </Link>
                    <div>
                      <Link href={`/app/flow?id=${t.workflow_id}`}>
                        <strong>{t.title}</strong>
                      </Link>
                      <small>
                        {
                          data.workflows.find((w) => w.id === t.workflow_id)
                            ?.name
                        }{" "}
                        · {date(t.due_at)}
                      </small>
                    </div>
                    <Badge>
                      {t.kind === "approval" ? "Freigabe" : "Aufgabe"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Keine offenen Aufgaben">
                Hier erscheinen Ihre nächsten Arbeitsschritte.
              </Empty>
            )}
          </section>
        )}
        {widgets.includes("knowledge") && (
          <section className="panel">
            <div className="panel-heading">
              <h2>Wissen im Team</h2>
              <Link className="text-link" href="/app/academy">
                Bibliothek öffnen →
              </Link>
            </div>
            {data.articles.length ? (
              <div className="knowledge-list">
                {data.articles.slice(0, 4).map((a) => (
                  <Link key={a.id} href={`/app/academy?id=${a.id}`}>
                    <span>
                      <strong>{a.title}</strong>
                      <small>
                        {a.category_name || "Allgemein"} · {date(a.updated_at)}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Wissen an einem Ort">
                Erstellen Sie Ihren ersten Academy-Artikel.
              </Empty>
            )}
            <div className="panel-pad">
              <Link className="text-link" href="/app/learning">
                Dokumente & Lernpfade →
              </Link>
            </div>
          </section>
        )}
        {widgets.includes("workflows") && (
          <section className="panel overview-wide">
            <div className="panel-heading">
              <h2>Aktuelle Abläufe</h2>
              <Link className="text-link" href="/app/flow">
                Alle Abläufe →
              </Link>
            </div>
            <WorkflowTable workflows={data.workflows.slice(0, 5)} />
          </section>
        )}
        {widgets.includes("activity") && (
          <section className="panel overview-wide">
            <div className="panel-heading">
              <h2>Letzte Aktivitäten</h2>
              <Link className="text-link" href="/app/audit">
                Verlauf öffnen →
              </Link>
            </div>
            <div className="activity-list">
              {data.activity.slice(0, 5).map((a) => (
                <div className="activity-item" key={a.id}>
                  <span className="avatar">
                    {initials(a.actor_name || "System")}
                  </span>
                  <div>
                    <p>
                      <strong>{a.actor_name || "System"}</strong>{" "}
                      {actionLabel[a.action] || "hat eine Änderung vorgenommen"}
                      .
                    </p>
                    <small>{date(a.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {widgets.length === 0 && (
        <Empty title="Ihre Übersicht ist bereit">
          <Link href="/app/settings">
            Widgets in den Firmenanpassungen auswählen →
          </Link>
        </Empty>
      )}
    </>
  );
}
