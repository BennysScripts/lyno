"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Check,
  Download,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  ActionForm,
  api,
  Badge,
  Button,
  date,
  Empty,
  Field,
  initials,
  Modal,
  roleLabel,
} from "./ui";
import type { AppData, Person } from "@/lib/types";
import { BillingView } from "./workspace-billing";
import {
  CustomizationView,
  PersonalPreferences,
  RoleManager,
} from "./workspace-customization";
import { actionLabel } from "./workspace-dashboard";
export function TeamView() {
  const { data, admin, mutate, run } = useApp();
  const [tab, setTab] = useState("members");
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [team, setTeam] = useState<AppData["teams"][number] | null | false>(
    false,
  );
  const [remove, setRemove] = useState<Person | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO CORE</span>
          <h1>Gute Arbeit ist Teamsache.</h1>
          <p>
            Menschen verbinden. Verantwortung teilen. Zugriffe bewusst
            gestalten.
          </p>
        </div>
        {admin && (
          <Button
            onClick={() =>
              tab === "teams" ? setTeam(null) : setInviting(true)
            }
          >
            <Plus size={14} />
            {tab === "teams" ? "Team erstellen" : "Person einladen"}
          </Button>
        )}
      </div>
      <div className="view-tabs">
        {[
          ["members", "Mitarbeitende", data.members.length],
          ["teams", "Teams", data.teams.length],
          ...(admin
            ? [
                [
                  "invitations",
                  "Einladungen",
                  data.invitations.filter((i) => !i.accepted_at).length,
                ],
              ]
            : []),
        ].map(([id, label, count]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(String(id))}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>
      {tab === "members" ? (
        <>
          <div className="toolbar">
            <div className="search-input">
              <Search />
              <input
                aria-label="Mitarbeitende suchen"
                placeholder="Person finden …"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div
            className="panel table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Datentabelle, horizontal scrollbar"
          >
            <table>
              <thead>
                <tr>
                  <th>PERSON</th>
                  <th>ROLLE</th>
                  <th>DABEI SEIT</th>
                  {admin && <th>AKTION</th>}
                </tr>
              </thead>
              <tbody>
                {data.members
                  .filter((m) =>
                    (m.name + " " + m.email)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="member-cell">
                          <span className="avatar">{initials(m.name)}</span>
                          <div>
                            <strong>
                              {m.name}
                              {m.id === data.me.id ? " (Sie)" : ""}
                            </strong>
                            <small>{m.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {admin &&
                        (data.me.role === "owner" ||
                          !["owner", "admin"].includes(m.role)) ? (
                          <select
                            className="member-role"
                            aria-label={`Rolle von ${m.name}`}
                            value={m.role}
                            onChange={(e) =>
                              run(
                                `members/${m.id}`,
                                { role: e.target.value },
                                "PATCH",
                                "Rolle aktualisiert.",
                              )
                            }
                          >
                            {Object.entries(roleLabel)
                              .filter(
                                ([k]) =>
                                  data.me.role === "owner" ||
                                  !["owner", "admin"].includes(k),
                              )
                              .map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <Badge>{roleLabel[m.role]}</Badge>
                        )}
                      </td>
                      <td className="muted">{date(m.created_at)}</td>
                      {admin && (
                        <td>
                          <button
                            disabled={
                              data.me.role !== "owner" &&
                              ["owner", "admin"].includes(m.role)
                            }
                            className="icon-button"
                            aria-label={`${m.name} entfernen`}
                            onClick={() => setRemove(m)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="notice" style={{ marginTop: 20 }}>
            Inhaber verwalten Abos und Unternehmensdaten. Admins verwalten das
            Team. Das Management gestaltet Prozesse und Wissen und erteilt
            Freigaben. Mitglieder bearbeiten Aufgaben; lesende Konten können
            Inhalte ansehen.
          </div>
        </>
      ) : tab === "teams" ? (
        <div className="team-grid">
          {data.teams.map((t) => (
            <article className="panel team-card" key={t.id}>
              <span className="template-icon">
                <Users size={19} />
              </span>
              <h3>{t.name}</h3>
              <p>
                {t.user_ids.length} Personen ·{" "}
                {t.user_ids
                  .map((id) => data.members.find((m) => m.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || "Noch keine Mitglieder"}
              </p>
              {admin && (
                <Button
                  variant="secondary"
                  aria-label={`Team bearbeiten: ${t.name}`}
                  onClick={() => setTeam(t)}
                >
                  Team bearbeiten
                </Button>
              )}
            </article>
          ))}
          {!data.teams.length && (
            <Empty title="Ein Team schafft Verbindung">
              Gruppieren Sie Mitarbeitende und teilen Sie Wissen gezielt.
            </Empty>
          )}
        </div>
      ) : (
        <div
          className="panel table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Datentabelle, horizontal scrollbar"
        >
          {data.invitations.length ? (
            <table>
              <thead>
                <tr>
                  <th>E-MAIL</th>
                  <th>ROLLE</th>
                  <th>STATUS</th>
                  <th>GÜLTIG BIS</th>
                  <th>AKTION</th>
                </tr>
              </thead>
              <tbody>
                {data.invitations.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{roleLabel[i.role]}</td>
                    <td>
                      <Badge tone={i.accepted_at ? "green" : "orange"}>
                        {i.accepted_at
                          ? "Angenommen"
                          : new Date(i.expires_at) < new Date()
                            ? "Abgelaufen"
                            : "Ausstehend"}
                      </Badge>
                    </td>
                    <td>{date(i.expires_at)}</td>
                    <td>
                      {!i.accepted_at &&
                        new Date(i.expires_at) > new Date() && (
                          <Button
                            variant="ghost small"
                            onClick={() =>
                              run(
                                `invitations/${i.id}`,
                                { revoke: true },
                                "PATCH",
                                "Einladung zurückgezogen.",
                              )
                            }
                          >
                            Zurückziehen
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="Ihr nächstes Teammitglied ist willkommen">
              Bereiten Sie eine Einladung mit der passenden Rolle vor.
            </Empty>
          )}
        </div>
      )}
      {inviting && (
        <Modal title="Eine Person einladen" onClose={() => setInviting(false)}>
          <ActionForm
            submit="Einladung vorbereiten"
            onSubmit={async (fd) => {
              await mutate(
                "invitations",
                { email: fd.get("email"), role: fd.get("role") },
                "POST",
                data.mailMode === "smtp"
                  ? "Einladung für den Versand vorgemerkt."
                  : "Einladung im lokalen Postfach vorbereitet.",
              );
              setInviting(false);
            }}
          >
            <Field label="E-Mail-Adresse">
              <input name="email" type="email" required />
            </Field>
            <Field label="Rolle">
              <select name="role" defaultValue="member">
                {[
                  "member",
                  "viewer",
                  "manager",
                  ...(data.me.role === "owner" ? ["admin"] : []),
                ].map((r) => (
                  <option value={r} key={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="notice">
              {data.mailMode === "smtp"
                ? "Die Einladung wird über den konfigurierten E-Mail-Dienst versendet."
                : "Lokaler Testbetrieb: Die Einladung wird im Dateipostfach abgelegt."}
              Die eingeladene Person benötigt ein Konto mit bestätigter
              E-Mail-Adresse. Der Link ist sieben Tage gültig.
            </div>
          </ActionForm>
        </Modal>
      )}
      {team !== false && (
        <TeamEditor team={team} onClose={() => setTeam(false)} />
      )}{" "}
      {remove && (
        <Modal title="Zugriff entfernen" onClose={() => setRemove(null)}>
          <ActionForm
            submit="Mitgliedschaft entfernen"
            onSubmit={async () => {
              await mutate(
                `members/${remove.id}`,
                { remove: true },
                "PATCH",
                "Mitgliedschaft entfernt.",
              );
              setRemove(null);
            }}
          >
            <p>
              {remove.name} verliert den Zugriff auf dieses Unternehmen.
              Bestehende Aufgaben bleiben erhalten und werden zur Neuzuweisung
              freigegeben.
            </p>
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>
                Ich bestätige, dass diese Person das Unternehmen verlassen soll.
              </span>
            </label>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
function TeamEditor({
  team,
  onClose,
}: {
  team: AppData["teams"][number] | null;
  onClose: () => void;
}) {
  const { data, mutate } = useApp();
  return (
    <Modal
      title={team ? "Team bearbeiten" : "Ein Team erstellen"}
      onClose={onClose}
    >
      <ActionForm
        onSubmit={async (fd) => {
          await mutate("teams", {
            id: team?.id,
            name: fd.get("name"),
            userIds: fd.getAll("members"),
          });
          onClose();
        }}
      >
        <Field label="Teamname">
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={team?.name}
          />
        </Field>
        <div className="team-checkboxes">
          {data.members.map((m) => (
            <label className="checkbox-label" key={m.id}>
              <input
                type="checkbox"
                name="members"
                value={m.id}
                defaultChecked={team?.user_ids.includes(m.id)}
              />
              <span>
                {m.name} · {roleLabel[m.role]}
              </span>
            </label>
          ))}
        </div>
      </ActionForm>
    </Modal>
  );
}
export function SettingsView() {
  const { data, admin, mutate, toast } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "billing" ? "billing" : "profile",
  );
  const [deleting, setDeleting] = useState<"company" | "account" | null>(null);
  const [company, setCompany] = useState(false);
  const owner = data.me.role === "owner";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO CORE</span>
          <h1>Ihr Arbeitsraum. Ihr Rahmen.</h1>
          <p>Alles Wichtige zu Profil, Unternehmen und Paket an einem Ort.</p>
        </div>
      </div>
      <div className="view-tabs">
        {[
          ["profile", "Mein Profil"],
          ["company", "Unternehmen"],
          ["customization", "Anpassungen"],
          ["roles", "Individuelle Rollen"],
          ["billing", "Paket & Abrechnung"],
          ["data", "Daten & Zugriff"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <div className="settings-grid">
          <section className="panel panel-pad">
            <h2>Wie dürfen wir Sie nennen?</h2>
            <p>Ihr Name ist für Ihr Team sichtbar.</p>
            <ActionForm
              onSubmit={async (fd) => {
                await mutate("profile", { name: fd.get("name") }, "PATCH");
              }}
            >
              <Field label="Ihr Name">
                <input
                  name="name"
                  defaultValue={data.me.name}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
              <Field label="E-Mail-Adresse">
                <input value={data.me.email} readOnly />
              </Field>
              <Badge tone={data.me.verified ? "green" : "orange"}>
                {data.me.verified
                  ? "E-Mail bestätigt"
                  : "Bestätigung ausstehend"}
              </Badge>
            </ActionForm>
          </section>
          <section className="panel panel-pad">
            <PersonalPreferences />
            <h2>Sicherheit & Anmeldung</h2>
            <p>
              Mit einem Passwortreset werden alle bestehenden Sitzungen beendet.
            </p>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const r = await api<{ message: string }>("auth/forgot", {
                    email: data.me.email,
                  });
                  toast(r.message);
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            >
              Passwortreset vorbereiten <Mail size={14} />
            </Button>
            <div className="notice" style={{ marginTop: 20 }}>
              {data.mailMode === "smtp"
                ? "Nachrichten werden vom Versand-Worker über Ihren konfigurierten SMTP-Dienst verarbeitet."
                : "Passwort- und Bestätigungslinks werden im lokalen Dateipostfach abgelegt. Es wird keine externe Nachricht versendet."}
            </div>
          </section>
        </div>
      ) : tab === "company" ? (
        <div className="settings-grid">
          <section className="panel panel-pad">
            <h2>Ihr Unternehmen</h2>
            <p>Diese Informationen helfen Ihrem Team bei der Orientierung.</p>
            {admin ? (
              <ActionForm
                onSubmit={async (fd) => {
                  await mutate(
                    "company",
                    {
                      name: fd.get("name"),
                      industry: fd.get("industry"),
                      size: fd.get("size"),
                    },
                    "PATCH",
                  );
                }}
              >
                <Field label="Unternehmensname">
                  <input
                    name="name"
                    defaultValue={data.organization.name}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </Field>
                <Field label="Branche">
                  <select
                    name="industry"
                    defaultValue={data.organization.industry}
                  >
                    <option>IT-Dienstleistung</option>
                    <option>Agentur</option>
                    <option>Beratung</option>
                    <option>Andere</option>
                  </select>
                </Field>
                <Field label="Teamgröße">
                  <select name="size" defaultValue={data.organization.size}>
                    <option>1–9</option>
                    <option>10–50</option>
                    <option>51–100</option>
                    <option>101+</option>
                  </select>
                </Field>
              </ActionForm>
            ) : (
              <div className="notice">
                {data.organization.name} · {data.organization.industry} ·{" "}
                {data.organization.size} Mitarbeitende. Änderungen sind für
                Inhaber und Admins verfügbar.
              </div>
            )}
          </section>
          <section className="panel panel-pad">
            <h2>Ein weiterer Arbeitsraum</h2>
            <p>
              Für ein weiteres Unternehmen können Sie einen getrennten
              Arbeitsraum mit eigenen Daten und Rollen erstellen.
            </p>
            <Button variant="secondary" onClick={() => setCompany(true)}>
              <Plus size={14} />
              Unternehmen erstellen
            </Button>
            <div className="notice" style={{ marginTop: 20 }}>
              Unternehmen wechseln Sie über die Auswahl in der linken
              Navigation. Jedes Unternehmen hat seine eigene Mitgliedschaft und
              Testphase.
            </div>
          </section>
        </div>
      ) : tab === "billing" ? (
        <BillingView />
      ) : tab === "customization" ? (
        <CustomizationView />
      ) : tab === "roles" ? (
        <RoleManager />
      ) : (
        <div className="settings-grid">
          {owner && (
            <section className="panel panel-pad">
              <h2>Ihre Daten gehören Ihnen.</h2>
              <p>
                Exportieren Sie Unternehmensdaten inklusive Prozessen, Wissen
                und Audit-Verlauf als maschinenlesbare JSON-Datei. Zugangsdaten
                und Session-Token sind ausgeschlossen.
              </p>
              <a className="button secondary" href="/api/export" download>
                <Download size={15} />
                Unternehmensdaten exportieren
              </a>
            </section>
          )}
          <section className="panel panel-pad danger-zone">
            <h2>Persönliches Konto löschen</h2>
            <p>
              Entfernt Ihr Konto und Ihre Mitgliedschaften. Als letzter Inhaber
              müssen Sie zuerst die Rolle übertragen oder das Unternehmen
              löschen.
            </p>
            <Button variant="danger" onClick={() => setDeleting("account")}>
              Kontolöschung vorbereiten
            </Button>
          </section>
          {owner && (
            <section className="panel panel-pad danger-zone">
              <h2>Unternehmen löschen</h2>
              <p>
                Entfernt dieses Unternehmen und alle zugehörigen Fachdaten
                unwiderruflich. Exportieren Sie zuvor Ihre Daten. Bestehende
                lokale Testnachrichten und Backups werden nicht automatisch
                gelöscht.
              </p>
              <Button variant="danger" onClick={() => setDeleting("company")}>
                Unternehmenslöschung vorbereiten
              </Button>
            </section>
          )}
        </div>
      )}
      {deleting && (
        <Modal
          title={
            deleting === "company"
              ? "Unternehmen endgültig löschen"
              : "Konto endgültig löschen"
          }
          onClose={() => setDeleting(null)}
        >
          <ActionForm
            submit="Endgültig löschen"
            onSubmit={async (fd) => {
              await api(
                deleting === "company" ? "company/delete" : "account/delete",
                {
                  password: fd.get("password"),
                  confirmation: fd.get("confirmation"),
                  deletePersonalAccount:
                    fd.get("deletePersonalAccount") === "on",
                },
              );
              window.location.href = "/anmelden";
            }}
          >
            <div className="error">
              Diese Aktion kann nicht rückgängig gemacht werden. Prüfen Sie
              vorher Ihren Datenexport.
            </div>
            {deleting === "company" && (
              <label className="checkbox-label">
                <input type="checkbox" name="deletePersonalAccount" />
                <span>
                  Auch mein persönliches Konto endgültig löschen, sofern keine
                  weiteren Unternehmensmitgliedschaften bestehen.
                </span>
              </label>
            )}
            <Field label="Ihr Passwort">
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field
              label={`Zur Bestätigung eingeben: ${deleting === "company" ? data.organization.name : "MEIN KONTO LÖSCHEN"}`}
            >
              <input name="confirmation" required autoComplete="off" />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {company && (
        <Modal
          title="Ein weiteres Unternehmen erstellen"
          onClose={() => setCompany(false)}
        >
          <ActionForm
            submit="Arbeitsraum erstellen"
            onSubmit={async (fd) => {
              await mutate("company/create", { name: fd.get("name") });
              setCompany(false);
            }}
          >
            <Field label="Unternehmensname">
              <input name="name" required minLength={2} maxLength={120} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
export function AuditView() {
  const { data, manage } = useApp();
  const [q, setQ] = useState("");
  if (!manage) return <Empty title="Dafür benötigen Sie Managementrechte" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NACHVOLLZIEHBAR ZUSAMMENARBEITEN</span>
          <h1>Der Verlauf Ihres Unternehmens.</h1>
          <p>
            Die letzten 100 Ereignisse. Der vollständige Audit-Verlauf ist im
            Unternehmensdatenexport enthalten.
          </p>
        </div>
        <Badge>
          <ShieldCheck size={11} />
          Serverseitig protokolliert
        </Badge>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search />
          <input
            aria-label="Audit-Verlauf durchsuchen"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nach Person oder Aktion suchen …"
          />
        </div>
      </div>
      <div
        className="panel table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Datentabelle, horizontal scrollbar"
      >
        <table>
          <thead>
            <tr>
              <th>ZEITPUNKT</th>
              <th>PERSON</th>
              <th>EREIGNIS</th>
              <th>REFERENZ</th>
            </tr>
          </thead>
          <tbody>
            {data.activity
              .filter((a) =>
                (a.action + " " + a.actor_name)
                  .toLowerCase()
                  .includes(q.toLowerCase()),
              )
              .map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString("de-DE")}</td>
                  <td>{a.actor_name || "System / gelöschtes Konto"}</td>
                  <td>
                    <strong>{actionLabel[a.action] || a.action}</strong>
                    <small className="audit-action">{a.action}</small>
                  </td>
                  <td className="muted">
                    <span title={a.entity_id}>
                      {a.entity_id?.slice(0, 8) || "—"}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function NotificationsView() {
  const { data, run } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ALLES WICHTIGE IM BLICK</span>
          <h1>Nachrichten für Sie.</h1>
          <p>
            Ihre Aufgaben, Erinnerungen und Neuigkeiten aus dem Arbeitsraum.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            run(
              "notifications/read",
              {},
              "POST",
              "Alle Nachrichten als gelesen markiert.",
            )
          }
          disabled={!data.notifications.some((n) => !n.read_at)}
        >
          <Check size={14} />
          Alle gelesen
        </Button>
      </div>
      <div className="panel">
        {data.notifications.length ? (
          data.notifications.map((n) => (
            <div
              className={`notification-item ${n.read_at ? "read" : ""}`}
              key={n.id}
            >
              <span className="template-icon">
                <Bell size={15} />
              </span>
              <div>
                <p>{n.title}</p>
                <small>
                  {date(n.created_at)} · {n.read_at ? "Gelesen" : "Neu"}
                </small>
              </div>
              <Link className="text-link" href={n.href}>
                Ansehen <ArrowUpRight size={13} />
              </Link>
            </div>
          ))
        ) : (
          <Empty title="Alles ruhig im Arbeitsraum">
            Neue Aufgaben und Erinnerungen erscheinen hier.
          </Empty>
        )}
      </div>
    </>
  );
}
