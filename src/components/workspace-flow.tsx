"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  GitBranch,
  GripVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { Template, Workflow, Task } from "@/lib/types";
import type { TemplateInput } from "@/lib/flow";
import { useApp, type EditorTemplate } from "./app-context";
import {
  ActionForm,
  api,
  Badge,
  Button,
  date,
  dateInput,
  Empty,
  Field,
  isoDate,
  Modal,
  priorityLabel,
  statusLabel,
} from "./ui";
import { WorkflowTable, actionLabel } from "./workspace-dashboard";
export function Flow() {
  const { data, start, editTemplate, manage, write, toast, mutate } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "templates" ? "templates" : "workflows",
  );
  const [layout, setLayout] = useState(data.settings.flow.view);
  const [savingView, setSavingView] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [listing, setListing] = useState<{
    items: Workflow[];
    tasks: Task[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api<NonNullable<typeof listing>>(
          `workflows?${new URLSearchParams({ search, status, priority, page: String(page) })}`,
        );
        if (active) setListing(result);
      } catch (e) {
        if (active) toast((e as Error).message, true);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, status, priority, page, data.workflows]);
  const selected = data.workflows.find((w) => w.id === params.get("id"));
  if (selected) return <WorkflowDetail workflow={selected} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO FLOW</span>
          <h1>Gemeinsam kommt Arbeit weiter.</h1>
          <p>
            Klare Abläufe. Verbindliche Schritte. Ein gemeinsamer Überblick.
          </p>
        </div>
        <div className="page-actions">
          {manage && (
            <Button variant="secondary" onClick={() => editTemplate()}>
              <Plus size={14} />
              Vorlage erstellen
            </Button>
          )}
          {write && (
            <Button
              onClick={() => start(data.templates[0])}
              disabled={!data.templates.length}
            >
              <Plus size={14} />
              Ablauf starten
            </Button>
          )}
        </div>
      </div>
      <div className="view-tabs">
        <button
          className={tab === "workflows" ? "active" : ""}
          onClick={() => setTab("workflows")}
        >
          Alle Abläufe <span>{listing?.total ?? data.workflows.length}</span>
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          Vorlagen <span>{data.templates.length}</span>
        </button>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search />
          <input
            aria-label="Abläufe und Vorlagen durchsuchen"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Nach einem Ablauf suchen …"
          />
        </div>
        {tab === "workflows" && (
          <>
            <select
              aria-label="Nach Status filtern"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Alle Status</option>
              <option value="active">In Bearbeitung</option>
              <option value="completed">Abgeschlossen</option>
              <option value="canceled">Abgebrochen</option>
            </select>
            <select
              aria-label="Nach Priorität filtern"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Alle Prioritäten</option>
              {Object.entries(priorityLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {tab === "workflows" && (
        <div className="toolbar saved-view-toolbar">
          <select
            aria-label="Gespeicherte Ansicht"
            defaultValue=""
            onChange={(e) => {
              const v = data.preferences.savedViews[Number(e.target.value)];
              if (v) {
                setSearch(v.query);
                setStatus(v.status);
                setPriority(v.priority);
                setPage(1);
              }
            }}
          >
            <option value="">Gespeicherte Ansichten</option>
            {data.preferences.savedViews.map((v, i) => (
              <option key={v.name} value={i}>
                {v.name}
              </option>
            ))}
          </select>
          <Button variant="secondary small" onClick={() => setSavingView(true)}>
            Ansicht speichern
          </Button>
          <Button
            variant="secondary small"
            onClick={() => setLayout(layout === "list" ? "board" : "list")}
          >
            {layout === "list" ? "Board anzeigen" : "Liste anzeigen"}
          </Button>
        </div>
      )}
      {savingView && (
        <Modal title="Ansicht speichern" onClose={() => setSavingView(false)}>
          <ActionForm
            onSubmit={async (fd) => {
              const name = String(fd.get("name"));
              await mutate("preferences", {
                ...data.preferences,
                savedViews: [
                  ...data.preferences.savedViews.filter((v) => v.name !== name),
                  { name, query: search, status, priority },
                ],
              });
              setSavingView(false);
            }}
          >
            <Field label="Name der Ansicht">
              <input name="name" minLength={2} maxLength={50} required />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {tab === "workflows" ? (
        <div className="panel" aria-busy={loading}>
          {layout === "list" ? (
            <WorkflowTable
              workflows={listing?.items || []}
              tasks={listing?.tasks || []}
            />
          ) : (
            <div className="workflow-board">
              {(["active", "completed", "canceled"] as const).map((s) => (
                <section key={s}>
                  <h3>{statusLabel[s]}</h3>
                  {listing?.items
                    .filter((w) => w.status === s)
                    .map((w) => (
                      <Link
                        className="board-card"
                        href={`/app/flow?id=${w.id}`}
                        key={w.id}
                      >
                        <strong>{w.name}</strong>
                        <small>
                          {priorityLabel[w.priority]} · {date(w.due_at)}
                        </small>
                      </Link>
                    ))}
                </section>
              ))}
            </div>
          )}
          <div className="pagination">
            <small>
              {listing?.total ?? 0} Abläufe · Seite {page} von{" "}
              {Math.max(1, Math.ceil((listing?.total || 0) / 25))}
            </small>
            <div>
              <Button
                variant="secondary small"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                Zurück
              </Button>
              <Button
                variant="secondary small"
                disabled={!listing || page * 25 >= listing.total || loading}
                onClick={() => setPage(page + 1)}
              >
                Weiter
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="template-grid">
          {data.templates
            .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
            .map((t) => (
              <article className="panel template-card" key={t.id}>
                <span className="template-icon">
                  <GitBranch size={20} />
                </span>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <div className="template-meta">
                  <span>{t.steps.length} Schritte</span>
                  <span>·</span>
                  <span>{t.fields.length} Felder</span>
                  {t.recurrence_days && (
                    <Badge>Alle {t.recurrence_days} Tage</Badge>
                  )}
                </div>
                <div className="template-actions">
                  {write && (
                    <Button onClick={() => start(t)}>
                      Ablauf starten <ArrowUpRight size={13} />
                    </Button>
                  )}
                  {manage && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        editTemplate({
                          ...t,
                          recurrenceDays: t.recurrence_days,
                        })
                      }
                    >
                      <Pencil size={12} />
                      Bearbeiten
                    </Button>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
    </>
  );
}
export function StartWorkflow({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const { data, mutate } = useApp();
  const [templateId, setTemplateId] = useState(template.id);
  const selected = data.templates.find((t) => t.id === templateId)!;
  const router = useRouter();
  return (
    <Modal title="Einen neuen Ablauf starten" onClose={onClose}>
      <ActionForm
        submit="Ablauf starten"
        onSubmit={async (fd) => {
          const formData: Record<string, string | number | boolean> = {};
          for (const f of selected.fields) {
            const value = fd.get(`field_${f.key}`);
            if (f.type === "checkbox") formData[f.key] = value === "on";
            else if (value !== null && value !== "")
              formData[f.key] =
                f.type === "number" ? Number(value) : String(value);
          }
          const w = await mutate<Workflow>(
            "workflows",
            {
              templateId,
              name: fd.get("name"),
              priority: fd.get("priority"),
              dueAt: isoDate(fd.get("dueAt")),
              formData,
            },
            "POST",
            "Ihr Ablauf ist gestartet.",
          );
          onClose();
          router.push(`/app/flow?id=${w.id}`);
        }}
      >
        <Field label="Vorlage">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted" style={{ fontSize: 12 }}>
          {selected.description}
        </p>
        <Field label="Name des Ablaufs">
          <input
            name="name"
            placeholder={`${selected.name} · Projekt / Kunde`}
            required
            minLength={2}
            maxLength={160}
          />
        </Field>
        <div className="form-grid">
          <Field label="Priorität">
            <select name="priority" defaultValue={data.settings.flow.priority}>
              {Object.entries(priorityLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gesamtfrist (optional)">
            <input type="date" name="dueAt" />
          </Field>
        </div>
        {selected.fields.length > 0 && (
          <div className="editor-section">
            <h3>Informationen zum Ablauf</h3>
            <div className="form-stack">
              {selected.fields.map((f) =>
                f.type === "checkbox" ? (
                  <label className="checkbox-label" key={templateId + f.key}>
                    <input
                      type="checkbox"
                      name={`field_${f.key}`}
                      defaultChecked={f.default === true}
                    />
                    <span>{f.label}</span>
                  </label>
                ) : (
                  <Field
                    key={templateId + f.key}
                    label={f.label + (f.required ? " *" : "")}
                  >
                    <input
                      name={`field_${f.key}`}
                      type={f.type === "number" ? "number" : "text"}
                      step="any"
                      required={f.required}
                      defaultValue={
                        f.default === undefined ? "" : String(f.default)
                      }
                      maxLength={2000}
                    />
                  </Field>
                ),
              )}
            </div>
          </div>
        )}
        <div className="notice">
          {selected.steps.length} Schritte · Freigaben können nur von Inhabern,
          Admins und dem Management entschieden werden. Bedingte Schritte werden
          beim Start ausgewertet.
        </div>
      </ActionForm>
    </Modal>
  );
}
function WorkflowDetail({ workflow: w }: { workflow: Workflow }) {
  const { data, run, mutate, manage, write } = useApp();
  const [edit, setEdit] = useState(false);
  const tasks = data.tasks.filter((t) => t.workflow_id === w.id);
  const comments = data.comments.filter((c) => c.workflow_id === w.id);
  return (
    <>
      <Link className="back-link" href="/app/flow">
        <ArrowLeft size={14} />
        Alle Abläufe
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {data.templates.find((t) => t.id === w.template_id)?.name ||
              "LYNO FLOW"}
          </span>
          <h1>{w.name}</h1>
          <p>
            Gestartet am {date(w.created_at)} von{" "}
            {w.creator_name || "ehemaligem Mitglied"}
          </p>
        </div>
        <div className="page-actions">
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
          {manage && w.status === "active" && (
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil size={13} />
              Bearbeiten
            </Button>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <section>
          {tasks.map((t) => (
            <article className={`workflow-step ${t.status}`} key={t.id}>
              <div className="step-top">
                <span
                  className={`step-check ${t.status === "done" ? "checked" : ""}`}
                >
                  {t.status === "done" ? (
                    <Check size={14} />
                  ) : t.kind === "approval" ? (
                    <ShieldCheck size={13} />
                  ) : (
                    t.position + 1
                  )}
                </span>
                <div>
                  <h3>{t.title}</h3>
                </div>
                <Badge
                  tone={
                    t.status === "done"
                      ? "green"
                      : t.status === "ready"
                        ? "orange"
                        : ""
                  }
                >
                  {statusLabel[t.status]}
                </Badge>
              </div>
              <p>
                {t.description ||
                  "Für diesen Schritt wurde keine zusätzliche Beschreibung hinterlegt."}
              </p>
              {t.article_id &&
                data.articles.some((a) => a.id === t.article_id) && (
                  <Link
                    href={`/app/academy?id=${t.article_id}`}
                    className="text-link mb"
                    style={{ fontSize: 11 }}
                  >
                    <BookOpen size={13} />
                    Wissen zu diesem Schritt
                  </Link>
                )}
              <div className="step-footer">
                {manage && w.status === "active" ? (
                  <select
                    aria-label={`Zuständigkeit für ${t.title}`}
                    value={t.assignee_id || ""}
                    onChange={(e) =>
                      run(
                        `tasks/${t.id}`,
                        {
                          action: "assign",
                          assigneeId: e.target.value || null,
                        },
                        "PATCH",
                        "Zuständigkeit aktualisiert.",
                      )
                    }
                  >
                    <option value="">Offen für das Team</option>
                    {data.members
                      .filter((m) => m.role !== "viewer")
                      .map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <small>
                    {data.members.find((m) => m.id === t.assignee_id)?.name ||
                      "Offen für das Team"}
                  </small>
                )}
                <small>Fällig: {date(t.due_at)}</small>
                {write &&
                  w.status === "active" &&
                  t.status === "ready" &&
                  (t.kind !== "approval" || manage) &&
                  (!t.assignee_id ||
                    t.assignee_id === data.me.id ||
                    manage) && (
                    <div className="step-actions">
                      {t.kind === "approval" && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            run(
                              `tasks/${t.id}`,
                              { action: "reject" },
                              "PATCH",
                              "Freigabe abgelehnt. Der Ablauf wurde beendet.",
                            )
                          }
                        >
                          <X size={12} />
                          Ablehnen
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          run(
                            `tasks/${t.id}`,
                            { action: "complete" },
                            "PATCH",
                            t.kind === "approval"
                              ? "Freigabe erteilt."
                              : "Schritt abgeschlossen.",
                          )
                        }
                      >
                        <Check size={13} />
                        {t.kind === "approval" ? "Freigeben" : "Abschließen"}
                      </Button>
                    </div>
                  )}
              </div>
            </article>
          ))}
        </section>
        <aside className="dashboard-aside">
          <div className="panel">
            <div className="panel-heading">
              <h2>Auf einen Blick</h2>
            </div>
            <div className="detail-meta">
              <div>
                <small>Priorität</small>
                <strong>{priorityLabel[w.priority]}</strong>
              </div>
              <div>
                <small>Gesamtfrist</small>
                <strong>{date(w.due_at)}</strong>
              </div>
              {Object.entries(w.form_data).map(([key, value]) => (
                <div key={key}>
                  <small>
                    {data.templates
                      .find((t) => t.id === w.template_id)
                      ?.fields.find((f) => f.key === key)?.label || key}
                  </small>
                  <strong>
                    {typeof value === "boolean"
                      ? value
                        ? "Ja"
                        : "Nein"
                      : String(value)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h2>Kommentare</h2>
              <Badge>{comments.length}</Badge>
            </div>
            {comments.length ? (
              comments.map((c) => (
                <div className="comment-item" key={c.id}>
                  <strong>{c.author_name || "Ehemaliges Mitglied"}</strong>
                  <small>{date(c.created_at)}</small>
                  <p>{c.body}</p>
                </div>
              ))
            ) : (
              <Empty title="Halten Sie Ihr Team auf dem Laufenden">
                Entscheidungen und Rückfragen bleiben hier am Ablauf.
              </Empty>
            )}
            {write && <CommentForm workflowId={w.id} />}
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h2>Verlauf</h2>
            </div>
            <div className="activity-list">
              {data.activity
                .filter((a) => a.entity_id === w.id)
                .map((a) => (
                  <div className="activity-item" key={a.id}>
                    <div>
                      <p>
                        <strong>{a.actor_name || "System"}</strong>{" "}
                        {actionLabel[a.action] || a.action}.
                      </p>
                      <small>
                        {date(a.created_at)}
                        {typeof a.details.task === "string"
                          ? ` · ${a.details.task}`
                          : ""}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </div>
      {edit && (
        <Modal title="Ablauf bearbeiten" onClose={() => setEdit(false)}>
          <ActionForm
            onSubmit={async (fd) => {
              await mutate(
                `workflows/${w.id}`,
                {
                  priority: fd.get("priority"),
                  dueAt: isoDate(fd.get("dueAt")),
                  status: fd.get("cancel") === "on" ? "canceled" : "active",
                },
                "PATCH",
              );
              setEdit(false);
            }}
          >
            <Field label="Priorität">
              <select name="priority" defaultValue={w.priority}>
                {Object.entries(priorityLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gesamtfrist">
              <input
                type="date"
                name="dueAt"
                defaultValue={dateInput(w.due_at)}
              />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" name="cancel" />
              <span>
                Ablauf abbrechen. Offene Schritte können anschließend nicht mehr
                bearbeitet werden.
              </span>
            </label>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
function CommentForm({ workflowId }: { workflowId: string }) {
  const { mutate } = useApp();
  const [body, setBody] = useState("");
  return (
    <div className="comment-form">
      <ActionForm
        submit="Kommentar hinzufügen"
        onSubmit={async () => {
          await mutate(
            "comments",
            { workflowId, body },
            "POST",
            "Kommentar gespeichert.",
          );
          setBody("");
        }}
      >
        <label className="sr-only" htmlFor="comment">
          Ihr Kommentar
        </label>
        <textarea
          id="comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Was sollte Ihr Team wissen?"
          required
          maxLength={4000}
        />
      </ActionForm>
    </div>
  );
}
export function TemplateEditor({
  template,
  onClose,
}: {
  template: EditorTemplate;
  onClose: () => void;
}) {
  const { data, mutate } = useApp();
  const [t, setT] = useState<EditorTemplate>(structuredClone(template));
  const patch = (d: Partial<EditorTemplate>) => setT((v) => ({ ...v, ...d }));
  function step(i: number, d: Partial<TemplateInput["steps"][number]>) {
    patch({ steps: t.steps.map((s, j) => (j === i ? { ...s, ...d } : s)) });
  }
  function field(i: number, d: Partial<TemplateInput["fields"][number]>) {
    patch({ fields: t.fields.map((f, j) => (j === i ? { ...f, ...d } : f)) });
  }
  function move(i: number, delta: number) {
    const steps = [...t.steps];
    [steps[i], steps[i + delta]] = [steps[i + delta], steps[i]];
    patch({ steps });
  }
  return (
    <Modal
      title={t.id ? "Prozessvorlage bearbeiten" : "Eine neue Prozessvorlage"}
      onClose={onClose}
      wide
    >
      <ActionForm
        submit="Vorlage speichern"
        onSubmit={async () => {
          await mutate(
            t.id ? `templates/${t.id}` : "templates",
            t,
            t.id ? "PATCH" : "POST",
            "Prozessvorlage gespeichert.",
          );
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Name der Vorlage">
            <input
              value={t.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
              minLength={2}
              maxLength={160}
            />
          </Field>
          <Field label="Wiederholung">
            <select
              value={t.recurrenceDays || ""}
              onChange={(e) =>
                patch({
                  recurrenceDays: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            >
              <option value="">Nur manuell starten</option>
              <option value="1">Täglich</option>
              <option value="7">Alle 7 Tage</option>
              <option value="14">Alle 14 Tage</option>
              <option value="30">Alle 30 Tage</option>
              <option value="90">Alle 90 Tage</option>
            </select>
          </Field>
          <Field label="Beschreibung">
            <textarea
              value={t.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              maxLength={2000}
            />
          </Field>
        </div>
        <div className="editor-section">
          <h3>01 · Formular beim Start</h3>
          <p className="muted mb" style={{ fontSize: 11 }}>
            Felder erfassen die Informationen für einen Ablauf. Bedingungen
            greifen auf den Feldschlüssel zu.
          </p>
          {t.fields.map((f, i) => (
            <div className="editor-field" key={i}>
              <div className="editor-step-head">
                <span>FORMULARFELD {i + 1}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Feld ${i + 1} entfernen`}
                  onClick={() =>
                    patch({ fields: t.fields.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="form-grid">
                <Field label="Bezeichnung">
                  <input
                    value={f.label}
                    onChange={(e) => field(i, { label: e.target.value })}
                    required
                  />
                </Field>
                <Field
                  label="Feldschlüssel"
                  hint="Kleinbuchstaben, Ziffern, Unterstrich"
                >
                  <input
                    value={f.key}
                    onChange={(e) => field(i, { key: e.target.value })}
                    pattern="[a-z][a-z0-9_]{0,39}"
                    required
                  />
                </Field>
                <Field label="Typ">
                  <select
                    value={f.type}
                    onChange={(e) =>
                      field(i, {
                        type: e.target.value as typeof f.type,
                        default: undefined,
                      })
                    }
                  >
                    <option value="text">Text</option>
                    <option value="number">Zahl</option>
                    <option value="checkbox">Ja / Nein</option>
                  </select>
                </Field>
                <Field label="Standardwert (für Wiederholungen)">
                  {f.type === "checkbox" ? (
                    <select
                      value={f.default === undefined ? "" : String(f.default)}
                      onChange={(e) =>
                        field(i, {
                          default:
                            e.target.value === ""
                              ? undefined
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="">Kein Standardwert</option>
                      <option value="true">Ja</option>
                      <option value="false">Nein</option>
                    </select>
                  ) : (
                    <input
                      value={f.default === undefined ? "" : String(f.default)}
                      type={f.type === "number" ? "number" : "text"}
                      onChange={(e) =>
                        field(i, {
                          default:
                            e.target.value === ""
                              ? undefined
                              : f.type === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => field(i, { required: e.target.checked })}
                  />
                  <span>Pflichtfeld</span>
                </label>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary small"
            onClick={() =>
              patch({
                fields: [
                  ...t.fields,
                  {
                    key: `feld_${t.fields.length + 1}`,
                    label: "",
                    type: "text",
                    required: false,
                  },
                ],
              })
            }
          >
            <Plus size={13} />
            Feld hinzufügen
          </Button>
        </div>
        <div className="editor-section">
          <h3>02 · Schritte & Freigaben</h3>
          {t.steps.map((s, i) => (
            <div className="editor-step" key={i}>
              <div className="editor-step-head">
                <GripVertical size={14} />
                <span>SCHRITT {String(i + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  className="icon-button"
                  aria-label={`Schritt ${i + 1} nach oben`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === t.steps.length - 1}
                  className="icon-button"
                  aria-label={`Schritt ${i + 1} nach unten`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  disabled={t.steps.length === 1}
                  className="icon-button"
                  aria-label={`Schritt ${i + 1} entfernen`}
                  onClick={() =>
                    patch({ steps: t.steps.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="form-grid">
                <Field label="Aufgabe / Titel">
                  <input
                    value={s.title}
                    onChange={(e) => step(i, { title: e.target.value })}
                    required
                    maxLength={160}
                  />
                </Field>
                <Field label="Schritttyp">
                  <select
                    value={s.kind}
                    onChange={(e) =>
                      step(i, { kind: e.target.value as "task" | "approval" })
                    }
                  >
                    <option value="task">Aufgabe</option>
                    <option value="approval">Freigabe durch Management</option>
                  </select>
                </Field>
                <Field label="Beschreibung">
                  <textarea
                    rows={2}
                    value={s.description}
                    onChange={(e) => step(i, { description: e.target.value })}
                    maxLength={3000}
                  />
                </Field>
                <Field label="Fällig nach Start (Tage)">
                  <input
                    type="number"
                    value={s.dueDays}
                    onChange={(e) =>
                      step(i, { dueDays: Number(e.target.value) })
                    }
                    min={0}
                    max={365}
                    required
                  />
                </Field>
                <Field label="Zuständigkeit">
                  <select
                    value={s.assigneeId || ""}
                    onChange={(e) =>
                      step(i, { assigneeId: e.target.value || null })
                    }
                  >
                    <option value="">Offen für das Team</option>
                    {data.members
                      .filter((m) => m.role !== "viewer")
                      .map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Wissensartikel verknüpfen">
                  <select
                    value={s.articleId || ""}
                    onChange={(e) =>
                      step(i, { articleId: e.target.value || null })
                    }
                  >
                    <option value="">Kein Artikel</option>
                    {data.articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="conditional-fields">
                <Field label="Nur ausführen, wenn …">
                  <select
                    value={s.condition?.field || ""}
                    onChange={(e) =>
                      step(i, {
                        condition: e.target.value
                          ? {
                              field: e.target.value,
                              equals:
                                t.fields.find((f) => f.key === e.target.value)
                                  ?.type === "checkbox"
                                  ? true
                                  : "",
                            }
                          : undefined,
                      })
                    }
                  >
                    <option value="">Immer ausführen</option>
                    {t.fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label || f.key}
                      </option>
                    ))}
                  </select>
                </Field>
                {s.condition && (
                  <Field label="… dieser Wert vorliegt">
                    {t.fields.find((f) => f.key === s.condition?.field)
                      ?.type === "checkbox" ? (
                      <select
                        value={String(s.condition.equals)}
                        onChange={(e) =>
                          step(i, {
                            condition: {
                              field: s.condition!.field,
                              equals: e.target.value === "true",
                            },
                          })
                        }
                      >
                        <option value="true">Ja</option>
                        <option value="false">Nein</option>
                      </select>
                    ) : (
                      <input
                        value={String(s.condition.equals)}
                        onChange={(e) =>
                          step(i, {
                            condition: {
                              field: s.condition!.field,
                              equals:
                                t.fields.find(
                                  (f) => f.key === s.condition?.field,
                                )?.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </Field>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary small"
            onClick={() =>
              patch({
                steps: [
                  ...t.steps,
                  { title: "", description: "", kind: "task", dueDays: 3 },
                ],
              })
            }
          >
            <Plus size={13} />
            Schritt hinzufügen
          </Button>
        </div>
        {t.recurrenceDays && (
          <div className="notice">
            Wiederkehrende Abläufe werden vom Job-Worker gestartet. Für
            Pflichtfelder sind Standardwerte erforderlich. Der nächste Termin
            liegt {t.recurrenceDays} Tage nach dem Speichern.
          </div>
        )}
        <div className="notice">
          Änderungen gelten für künftig gestartete Abläufe. Laufende Prozesse
          behalten ihre bestehenden Schritte.
        </div>
      </ActionForm>
    </Modal>
  );
}
