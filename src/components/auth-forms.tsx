"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Check, Sparkles } from "lucide-react";
import { ActionForm, api, Field, Logo, ThemeToggle, LinkButton } from "./ui";
export function AuthForm({
  mode,
  token = "",
  kind = "verify",
  plan = "starter",
  modules = ["flow", "academy", "assist", "insights"],
}: {
  mode: string;
  token?: string;
  kind?: string;
  plan?: string;
  modules?: string[];
}) {
  const [message, setMessage] = useState("");
  const register = mode === "registrieren";
  const titles: Record<string, string> = {
    einrichten: "Ein neuer Arbeitsraum.",
    registrieren: "Gute Arbeit beginnt hier.",
    anmelden: "Schön, dass Sie da sind.",
    "passwort-vergessen": "Ein neuer Zugang.",
    "passwort-neu": "Ein frischer Start.",
    bestaetigen: "Fast geschafft.",
    einladung: "Ihr Team wartet auf Sie.",
  };
  const descriptions: Record<string, string> = {
    einrichten:
      "Ihr Konto hat aktuell keinen Arbeitsraum. Erstellen Sie ein Unternehmen oder öffnen Sie eine Einladung.",
    registrieren:
      "Erstellen Sie Ihren gemeinsamen Arbeitsraum. In wenigen Schritten.",
    anmelden: "Melden Sie sich in Ihrem LYNO-Arbeitsraum an.",
    "passwort-vergessen":
      "Wir bereiten einen Link vor, mit dem Sie Ihr Passwort zurücksetzen können.",
    "passwort-neu":
      "Wählen Sie ein sicheres Passwort mit mindestens 12 Zeichen.",
    bestaetigen: "Bestätigen Sie Ihre Anmeldung mit einem Klick.",
    einladung:
      "Melden Sie sich mit der eingeladenen E-Mail-Adresse an und bestätigen Sie sie, bevor Sie beitreten.",
  };
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Logo />
        <div>
          <span className="eyebrow">MEHR RAUM FÜR DAS WESENTLICHE</span>
          <h2>
            Zusammen
            <br />
            wird Arbeit
            <br />
            <em>klarer.</em>
          </h2>
          <p>
            Ein Arbeitsraum für Ihr Wissen,
            <br />
            Ihre Prozesse und Ihr Team.
          </p>
          <div className="auth-motif">
            <div>
              <Check />
              Prozesse verbinden.
            </div>
            <div>
              <Sparkles />
              Wissen weitergeben.
            </div>
            <div>
              <ShieldCheck />
              Verantwortung teilen.
            </div>
          </div>
        </div>
        <small>LYNO · Für Teams, die gemeinsam weiterdenken.</small>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-top">
          <Link href="/">← Zur Website</Link>
          <ThemeToggle />
        </div>
        <div className="auth-card">
          <span className="eyebrow">
            {register ? "IHR NEUER ARBEITSRAUM" : "WILLKOMMEN BEI LYNO"}
          </span>
          <h1>{titles[mode]}</h1>
          <p>{descriptions[mode]}</p>
          {message ? (
            <div className="success" role="status">
              <Check />
              <p>{message}</p>
              <LinkButton href={mode === "einladung" ? "/app" : "/anmelden"}>
                Weiter <ArrowUpRight size={16} />
              </LinkButton>
            </div>
          ) : (
            <ActionForm
              submit={
                mode === "einrichten"
                  ? "Unternehmen erstellen"
                  : register
                    ? "Arbeitsraum erstellen"
                    : mode === "anmelden"
                      ? "Anmelden"
                      : mode === "bestaetigen"
                        ? "Anmeldung bestätigen"
                        : mode === "einladung"
                          ? "Einladung annehmen"
                          : mode === "passwort-neu"
                            ? "Passwort speichern"
                            : "Link vorbereiten"
              }
              onSubmit={async (fd) => {
                if (mode === "einrichten") {
                  await api("company/onboard", { name: fd.get("company") });
                  window.location.href = "/app";
                } else if (register) {
                  await api("auth/register", {
                    name: fd.get("name"),
                    company: fd.get("company"),
                    plan: fd.get("plan"),
                    modules,
                    email: fd.get("email"),
                    password: fd.get("password"),
                  });
                  window.location.href = "/app?welcome=1";
                } else if (mode === "anmelden") {
                  await api("auth/login", {
                    email: fd.get("email"),
                    password: fd.get("password"),
                  });
                  window.location.href = token
                    ? `/einladung?token=${encodeURIComponent(token)}`
                    : "/app";
                } else if (mode === "passwort-vergessen") {
                  const r = await api<{ message: string }>("auth/forgot", {
                    email: fd.get("email"),
                  });
                  setMessage(r.message);
                } else if (mode === "passwort-neu") {
                  const r = await api<{ message: string }>("auth/reset", {
                    token,
                    password: fd.get("password"),
                  });
                  setMessage(r.message);
                } else if (mode === "bestaetigen") {
                  const r = await api<{ message: string }>(
                    kind === "waitlist" ? "waitlist/confirm" : "auth/verify",
                    { token },
                  );
                  setMessage(r.message);
                } else if (mode === "einladung") {
                  await api("invitations/accept", { token });
                  setMessage("Sie sind jetzt Teil des Unternehmens.");
                }
              }}
            >
              {mode === "einrichten" && (
                <Field label="Unternehmen">
                  <input
                    name="company"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </Field>
              )}
              {register && (
                <>
                  <Field label="Ihr Name">
                    <input
                      name="name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      placeholder="Vor- und Nachname"
                      required
                    />
                  </Field>
                  <Field label="Unternehmen">
                    <input
                      name="company"
                      autoComplete="organization"
                      minLength={2}
                      maxLength={120}
                      placeholder="Name Ihres Unternehmens"
                      required
                    />
                  </Field>
                </>
              )}
              {register && (
                <Field
                  label="Paket für Ihre Testphase"
                  hint={`Gewählt: CORE${modules.length ? " + " + modules.join(", ").toUpperCase() : ""}. Während der Testphase sind alle Module verfügbar.`}
                >
                  <select name="plan" defaultValue={plan}>
                    <option value="starter">
                      Starter · bis zu 15 Personen
                    </option>
                    <option value="business">
                      Business · bis zu 50 Personen
                    </option>
                    <option value="premium">
                      Premium · bis zu 150 Personen
                    </option>
                  </select>
                </Field>
              )}
              {["registrieren", "anmelden", "passwort-vergessen"].includes(
                mode,
              ) && (
                <Field label="E-Mail-Adresse">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="sie@unternehmen.de"
                    required
                  />
                </Field>
              )}
              {["registrieren", "anmelden", "passwort-neu"].includes(mode) && (
                <Field
                  label="Passwort"
                  hint={
                    mode === "anmelden"
                      ? undefined
                      : "Mindestens 12 Zeichen. Nutzen Sie einen Passwortmanager."
                  }
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "anmelden" ? "current-password" : "new-password"
                    }
                    minLength={mode === "anmelden" ? 1 : 12}
                    maxLength={128}
                    required
                  />
                </Field>
              )}
              {mode === "anmelden" && (
                <Link className="forgot-link" href="/passwort-vergessen">
                  Passwort vergessen?
                </Link>
              )}
              {register && (
                <p className="form-legal">
                  14 Tage Testphase. Keine Kreditkarte. Lokaler
                  Entwicklungsbetrieb.{" "}
                  <Link href="/datenschutz">Datenschutzhinweise</Link> und{" "}
                  <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>{" "}
                  sind vor einem kommerziellen Einsatz zu vervollständigen.
                </p>
              )}
              {mode === "einladung" && (
                <div className="notice">
                  Noch nicht angemeldet?{" "}
                  <Link href={`/anmelden?token=${encodeURIComponent(token)}`}>
                    Anmelden
                  </Link>{" "}
                  oder <Link href="/registrieren">Konto erstellen</Link>.
                  Bewahren Sie anschließend diesen Einladungslink auf.
                </div>
              )}
            </ActionForm>
          )}
          {["registrieren", "anmelden"].includes(mode) && (
            <p className="auth-switch">
              {register
                ? "Sie nutzen LYNO bereits?"
                : "Noch keinen Arbeitsraum?"}{" "}
              <Link href={register ? "/anmelden" : "/registrieren"}>
                {register ? "Anmelden" : "Kostenlos starten"}{" "}
                <ArrowUpRight size={13} />
              </Link>
            </p>
          )}
          {mode === "anmelden" && (
            <div className="local-hint">
              Beispielzugang nach <code>npm run db:seed</code>:<br />
              <strong>lea@lyno.example</strong> ·{" "}
              <strong>Lyno-Demo-2026!</strong>
            </div>
          )}
        </div>
        <div className="auth-bottom">
          <ShieldCheck size={14} />
          Serverseitig geschützte Anmeldung · Lokaler Testbetrieb
        </div>
      </main>
    </div>
  );
}
