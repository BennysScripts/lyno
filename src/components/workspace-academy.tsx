"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Article } from "@/lib/types";
import { useApp } from "./app-context";
import { ActionForm, Badge, Button, date, Empty, Field, Modal } from "./ui";
export function Academy() {
  const { data, manage, mutate, start, toast } = useApp();
  const [pendingCheckpoints, setPendingCheckpoints] = useState<
    Record<string, boolean>
  >({});
  async function toggleCheckpoint(id: string, done: boolean) {
    setPendingCheckpoints((current) => ({ ...current, [id]: done }));
    try {
      await mutate(
        "checklist/toggle",
        { id, done },
        "POST",
        "Fortschritt aktualisiert.",
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Fortschritt konnte nicht gespeichert werden.",
        true,
      );
    } finally {
      setPendingCheckpoints((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }
  const canComplete =
    data.me.role !== "viewer" &&
    data.access.active &&
    data.permissions.includes("academy.read");
  const canStartFlow =
    data.me.role !== "viewer" &&
    data.access.active &&
    data.permissions.includes("flow.write");
  const params = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "checklist" ? "checklist" : "articles",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editor, setEditor] = useState<Article | null | false>(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [checklistModal, setChecklistModal] = useState(false);
  const selected = data.articles.find((a) => a.id === params.get("id"));
  const editorUI = editor !== false && (
    <ArticleEditor article={editor} onClose={() => setEditor(false)} />
  );
  if (selected)
    return (
      <>
        <Link className="back-link" href="/app/academy">
          <ArrowLeft size={14} />
          Zur Wissensbibliothek
        </Link>
        <div className="article-layout">
          <article className="panel">
            <div className="article-header">
              <div className="detail-heading">
                <Badge>{selected.category_name || "Allgemein"}</Badge>
                {manage && (
                  <Button
                    variant="secondary small"
                    onClick={() => setEditor(selected)}
                  >
                    <Pencil size={12} />
                    Bearbeiten
                  </Button>
                )}
              </div>
              <h1>{selected.title}</h1>
              <p>
                {selected.author_name || "Ehemaliges Mitglied"} · Aktualisiert
                am {date(selected.updated_at)} ·{" "}
                {selected.visibility === "company"
                  ? "Gesamtes Unternehmen"
                  : selected.visibility === "team"
                    ? "Teamzugriff"
                    : "Management"}
              </p>
            </div>
            <div className="prose">
              <ReactMarkdown>{selected.body}</ReactMarkdown>
            </div>
          </article>
          <div className="modal-actions">
            <Link
              className="button secondary"
              href={`/app/assist?article=${selected.id}&mode=summary`}
            >
              Mit Assist zusammenfassen <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        {editorUI}
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO ACADEMY</span>
          <h1>Wissen, das im Team bleibt.</h1>
          <p>{data.settings.academy.welcome}</p>
        </div>
        <div className="page-actions">
          <Link className="button secondary" href="/app/learning">
            Dokumente & Lernpfade
          </Link>
          {manage && (
            <>
              <Button
                variant="secondary"
                onClick={() => setCategoryModal(true)}
              >
                <FolderPlus size={14} />
                Kategorie
              </Button>
              <Button
                onClick={() =>
                  tab === "checklist"
                    ? setChecklistModal(true)
                    : setEditor(null)
                }
              >
                <Plus size={14} />
                {tab === "checklist" ? "Checkpunkt" : "Artikel erstellen"}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="view-tabs">
        <button
          className={tab === "articles" ? "active" : ""}
          onClick={() => setTab("articles")}
        >
          Wissensbibliothek <span>{data.articles.length}</span>
        </button>
        <button
          className={tab === "checklist" ? "active" : ""}
          onClick={() => setTab("checklist")}
        >
          Meine Einarbeitung{" "}
          <span>
            {data.checklist.filter((i) => i.completed_at).length}/
            {data.checklist.length}
          </span>
        </button>
      </div>
      {tab === "articles" ? (
        <>
          <div className="toolbar">
            <div className="search-input">
              <Search />
              <input
                aria-label="Firmenwissen durchsuchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Wissen finden …"
              />
            </div>
            <select
              aria-label="Kategorie filtern"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Alle Kategorien</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="article-grid">
            {[...data.articles]
              .sort((a, b) =>
                data.settings.academy.sort === "title"
                  ? a.title.localeCompare(b.title, "de")
                  : b.updated_at.localeCompare(a.updated_at),
              )
              .filter(
                (a) =>
                  (!category || a.category_id === category) &&
                  (a.title + " " + a.body)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((a) => (
                <Link
                  className="article-card"
                  href={`/app/academy?id=${a.id}`}
                  key={a.id}
                >
                  <Badge tone="green">
                    <BookOpen size={10} />
                    {a.category_name || "Allgemein"}
                  </Badge>
                  <h3>{a.title}</h3>
                  <p>{a.body.replace(/[#*`\[\]]/g, "")}</p>
                  <small>
                    <ShieldCheck size={12} />
                    {a.visibility === "company"
                      ? "Für das Unternehmen"
                      : a.visibility === "team"
                        ? "Für Ihr Team"
                        : "Für das Management"}{" "}
                    · {date(a.updated_at)}
                  </small>
                </Link>
              ))}
          </div>
          {!data.articles.filter(
            (a) =>
              (!category || a.category_id === category) &&
              (a.title + " " + a.body)
                .toLowerCase()
                .includes(query.toLowerCase()),
          ).length && (
            <Empty title="Noch kein passender Artikel">
              Ändern Sie Ihre Suche oder erstellen Sie einen neuen
              Wissensartikel.
            </Empty>
          )}
        </>
      ) : (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Gut im Team ankommen.</h2>
              <p>Ihr persönlicher Fortschritt wird für Sie gespeichert.</p>
            </div>
            <Badge tone="green">
              {data.checklist.filter((i) => i.completed_at).length} von{" "}
              {data.checklist.length}
            </Badge>
          </div>
          {data.checklist.length ? (
            data.checklist.map((i) => (
              <div
                className={`checklist-row ${i.completed_at ? "done" : ""}`}
                key={i.id}
              >
                <input
                  type="checkbox"
                  aria-label={`${i.title} als ${i.completed_at ? "offen" : "erledigt"} markieren`}
                  checked={pendingCheckpoints[i.id] ?? !!i.completed_at}
                  disabled={!canComplete || i.id in pendingCheckpoints}
                  aria-busy={i.id in pendingCheckpoints}
                  onChange={(e) => toggleCheckpoint(i.id, e.target.checked)}
                />
                <div>
                  <strong>{i.title}</strong>
                  <p>
                    {i.completed_at
                      ? `Erledigt am ${date(i.completed_at)}`
                      : "In Ihrem Tempo. Schritt für Schritt."}
                  </p>
                </div>
                {i.article_id && (
                  <Link
                    href={`/app/academy?id=${i.article_id}`}
                    className="text-link"
                  >
                    Lesen <ArrowUpRight size={13} />
                  </Link>
                )}
                {i.template_id &&
                  canStartFlow &&
                  data.templates.some((t) => t.id === i.template_id) && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const t = data.templates.find(
                          (t) => t.id === i.template_id,
                        );
                        if (t) start(t);
                      }}
                    >
                      Ablauf starten
                    </Button>
                  )}
              </div>
            ))
          ) : (
            <Empty title="Einarbeitung gemeinsam gestalten">
              Das Management kann hier Checkpunkte und passende Wissensartikel
              ergänzen.
            </Empty>
          )}
        </div>
      )}
      {editorUI}
      {categoryModal && (
        <Modal
          title="Kategorie hinzufügen"
          onClose={() => setCategoryModal(false)}
        >
          <ActionForm
            onSubmit={async (fd) => {
              await mutate("categories", { name: fd.get("name") });
              setCategoryModal(false);
            }}
          >
            <Field label="Name der Kategorie">
              <input name="name" required minLength={2} maxLength={80} />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {checklistModal && (
        <Modal
          title="Einarbeitungscheckpunkt hinzufügen"
          onClose={() => setChecklistModal(false)}
        >
          <ActionForm
            onSubmit={async (fd) => {
              await mutate("checklist", {
                title: fd.get("title"),
                articleId: fd.get("articleId") || null,
                templateId: fd.get("templateId") || null,
              });
              setChecklistModal(false);
            }}
          >
            <Field label="Titel">
              <input name="title" required minLength={2} maxLength={160} />
            </Field>
            <Field label="Wissensartikel">
              <select name="articleId">
                <option value="">Kein Artikel</option>
                {data.articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Flow-Vorlage">
              <select name="templateId">
                <option value="">Keine Vorlage</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
function ArticleEditor({
  article,
  onClose,
}: {
  article: Article | null;
  onClose: () => void;
}) {
  const { data, mutate } = useApp();
  const [body, setBody] = useState(article?.body || "");
  const [preview, setPreview] = useState(false);
  const [visibility, setVisibility] = useState(
    article?.visibility || "company",
  );
  return (
    <Modal
      title={article ? "Wissen weiterentwickeln" : "Wissen mit dem Team teilen"}
      onClose={onClose}
      wide
    >
      <ActionForm
        submit="Artikel speichern"
        onSubmit={async (fd) => {
          await mutate(
            article ? `articles/${article.id}` : "articles",
            {
              title: fd.get("title"),
              body,
              categoryId: fd.get("categoryId") || null,
              visibility,
              teamId: visibility === "team" ? fd.get("teamId") : null,
            },
            article ? "PATCH" : "POST",
            "Artikel gespeichert.",
          );
          onClose();
        }}
      >
        <Field label="Titel">
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={article?.title}
          />
        </Field>
        <div className="form-grid">
          <Field label="Kategorie">
            <select name="categoryId" defaultValue={article?.category_id || ""}>
              <option value="">Allgemein</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sichtbarkeit">
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as typeof visibility)
              }
            >
              <option value="company">Gesamtes Unternehmen</option>
              <option value="managers">Nur Management</option>
              <option value="team">Ein bestimmtes Team</option>
            </select>
          </Field>
          {visibility === "team" && (
            <Field label="Team">
              <select
                name="teamId"
                required
                defaultValue={article?.team_id || ""}
              >
                <option value="" disabled>
                  Team auswählen
                </option>
                {data.teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="view-tabs">
          <button
            type="button"
            className={!preview ? "active" : ""}
            onClick={() => setPreview(false)}
          >
            Schreiben
          </button>
          <button
            type="button"
            className={preview ? "active" : ""}
            onClick={() => setPreview(true)}
          >
            Vorschau
          </button>
        </div>
        {preview ? (
          <div className="panel prose">
            <ReactMarkdown>
              {body || "Ihre Vorschau erscheint hier."}
            </ReactMarkdown>
          </div>
        ) : (
          <Field
            label="Inhalt"
            hint="Markdown: # Überschrift, **fett**, - Liste, [Link](https://…). HTML wird nicht ausgeführt."
          >
            <textarea
              className="markdown-editor"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={10}
              maxLength={50000}
              placeholder="# Das sollte Ihr Team wissen …"
            />
          </Field>
        )}
        <div className="notice">
          Sichtbarkeitsregeln gelten auch für Suche, verknüpfte Aufgaben und
          Assist.
        </div>
      </ActionForm>
    </Modal>
  );
}
