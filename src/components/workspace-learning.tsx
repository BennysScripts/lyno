"use client";
import { useState } from "react";
import Link from "next/link";
import { useApp } from "./app-context";
import { ActionForm, Button, Empty, Field, Modal, date } from "./ui";
export function LearningView() {
  const { data, manage, mutate, run } = useApp();
  const [modal, setModal] = useState<"document" | "path" | null>(null);
  const [articleIds, setArticleIds] = useState<string[]>([]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dokumente & Lernpfade</h1>
          <p>
            Unterlagen sicher teilen und Einarbeitung Schritt für Schritt
            begleiten.
          </p>
        </div>
        {manage && (
          <div className="page-actions">
            <Button variant="secondary" onClick={() => setModal("document")}>
              Dokument hochladen
            </Button>
            <Button
              onClick={() => {
                setArticleIds([]);
                setModal("path");
              }}
            >
              Lernpfad erstellen
            </Button>
          </div>
        )}
      </div>
      <section className="panel panel-pad mb">
        <h2>Gemeinsam lernen</h2>
        {!data.learningPaths.length && (
          <Empty title="Noch keine Lernpfade">
            Verbinden Sie zugängliche Academy-Artikel zu einer geordneten
            Einarbeitung.
          </Empty>
        )}
        {data.learningPaths.map((p) => (
          <article key={p.id} className="learning-path">
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <p>
              {p.completedIds.length} von {p.article_ids.length} Schritten
              abgeschlossen
            </p>
            <progress
              value={p.completedIds.length}
              max={p.article_ids.length}
              aria-label={`Fortschritt ${p.title}`}
            />
            <ol>
              {p.article_ids.map((id, index) => (
                <li key={id}>
                  <Link href={`/app/academy?id=${id}`}>
                    {data.articles.find((a) => a.id === id)?.title}
                  </Link>
                  <Button
                    variant="secondary small"
                    disabled={
                      !p.completedIds.includes(id) &&
                      p.article_ids
                        .slice(0, index)
                        .some((a) => !p.completedIds.includes(a))
                    }
                    onClick={() =>
                      run("learning/complete", {
                        pathId: p.id,
                        articleId: id,
                        complete: !p.completedIds.includes(id),
                      })
                    }
                  >
                    {p.completedIds.includes(id)
                      ? "Abschluss zurücksetzen"
                      : "Als gelernt markieren"}
                  </Button>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Dokumentenablage</h2>
        </div>
        <p className="panel-pad">
          PDF, Markdown und Text · maximal 2 MB pro Datei,{" "}
          {data.access.plan.documentMB} MB insgesamt. Textdateien bis 50 KB
          werden als durchsuchbare Wissensartikel aufgenommen. PDFs bleiben
          zugriffsgeschützte Downloads.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Format</th>
                <th>Größe</th>
                <th>Datum</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.mime === "application/pdf" ? "PDF" : "Text"}</td>
                  <td>{Math.ceil(d.size_bytes / 1024)} KB</td>
                  <td>{date(d.created_at)}</td>
                  <td>
                    <a
                      href={`/api/documents/${d.id}`}
                      className="text-link"
                      download
                    >
                      {d.filename}
                    </a>
                  </td>
                </tr>
              ))}
              {!data.documents.length && (
                <tr>
                  <td colSpan={5}>Noch keine Dokumente gespeichert.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <Modal
          title={
            modal === "document" ? "Dokument hochladen" : "Lernpfad erstellen"
          }
          onClose={() => setModal(null)}
        >
          <ActionForm
            submit={
              modal === "document" ? "Dokument speichern" : "Lernpfad speichern"
            }
            onSubmit={async (fd) => {
              if (modal === "document") {
                const file = fd.get("file") as File;
                if (file.size > 2 * 1024 * 1024)
                  throw new Error("Die Datei darf höchstens 2 MB groß sein.");
                const buffer = new Uint8Array(await file.arrayBuffer());
                let binary = "";
                for (const n of buffer) binary += String.fromCharCode(n);
                await mutate("documents", {
                  title: fd.get("title"),
                  filename: file.name,
                  mime: file.name.endsWith(".md")
                    ? "text/markdown"
                    : file.type || "text/plain",
                  base64: btoa(binary),
                  visibility: fd.get("visibility"),
                  teamId: fd.get("teamId") || null,
                });
              } else
                await mutate("learning", {
                  title: fd.get("title"),
                  description: fd.get("description"),
                  articleIds,
                });
              setModal(null);
            }}
          >
            <Field label="Titel">
              <input name="title" required minLength={2} maxLength={120} />
            </Field>
            {modal === "document" ? (
              <>
                <Field label="Datei">
                  <input
                    type="file"
                    name="file"
                    accept=".pdf,.txt,.md"
                    required
                  />
                </Field>
                <Field label="Sichtbarkeit">
                  <select name="visibility">
                    <option value="company">Gesamtes Unternehmen</option>
                    <option value="managers">Management</option>
                    <option value="team">Gewähltes Team</option>
                  </select>
                </Field>
                <Field label="Team bei Teamsichtbarkeit">
                  <select name="teamId">
                    <option value="">Kein Team</option>
                    {data.teams.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Beschreibung">
                  <textarea name="description" maxLength={1000} />
                </Field>
                <Field label="Artikel hinzufügen">
                  <select
                    value=""
                    onChange={(e) => {
                      if (
                        e.target.value &&
                        !articleIds.includes(e.target.value)
                      )
                        setArticleIds([...articleIds, e.target.value]);
                    }}
                  >
                    <option value="">Artikel auswählen</option>
                    {data.articles
                      .filter((a) => !articleIds.includes(a.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </Field>
                <ol>
                  {articleIds.map((id, index) => (
                    <li className="role-row" key={id}>
                      <span>
                        {index + 1}.{" "}
                        {data.articles.find((a) => a.id === id)?.title}
                      </span>
                      <Button
                        variant="secondary small"
                        onClick={() =>
                          setArticleIds(articleIds.filter((a) => a !== id))
                        }
                      >
                        Entfernen
                      </Button>
                    </li>
                  ))}
                </ol>
                <p>
                  Die Reihenfolge entspricht der Auswahl. Ein Lernpfad ist nur
                  für Personen sichtbar, die alle enthaltenen Artikel lesen
                  dürfen.
                </p>
              </>
            )}
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
