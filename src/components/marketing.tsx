"use client";
import { Pricing } from "./pricing";
import { products } from "@/lib/product-content";
import type { catalog } from "@/lib/catalog";
import type { campaignStatus } from "@/lib/discount";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  GitBranch,
  Layers3,
  Menu,
  Play,
  MessageSquare,
  X,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  ActionForm,
  api,
  Badge,
  Button,
  Field,
  LinkButton,
  Logo,
  Modal,
  ThemeToggle,
} from "./ui";
const demoSteps = [
  "Briefing abstimmen",
  "Zugänge einrichten",
  "Übergabe freigeben",
];
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="marketing-nav">
      <div className="nav-inner">
        <Logo />
        <nav className={open ? "open" : ""} aria-label="Hauptnavigation">
          <Link onClick={() => setOpen(false)} href="/#produkt">
            Produkt
          </Link>
          <Link onClick={() => setOpen(false)} href="/#module">
            Module
          </Link>
          <Link onClick={() => setOpen(false)} href="/#preise">
            Preise
          </Link>
          <Link onClick={() => setOpen(false)} href="/#faq">
            Fragen & Antworten
          </Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="login-link" href="/anmelden">
            Anmelden
          </Link>
          <LinkButton href="/registrieren">
            LYNO entdecken <ArrowUpRight size={16} />
          </LinkButton>
          <button
            className="icon-button mobile-menu"
            aria-label="Menü öffnen"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function ProductDemo({ expanded = false }: { expanded?: boolean }) {
  const [step, setStep] = useState(0);
  return (
    <div className={`product-demo ${expanded ? "expanded" : ""}`}>
      <aside className="demo-sidebar">
        <span className="demo-brand">Lyno</span>
        <span className="demo-company">
          <span className="avatar tiny">N</span>Nordlicht Studio
          <ChevronDown size={12} />
        </span>
        <small>ARBEITSRAUM</small>
        <span>
          <Layers3 size={15} />
          Übersicht
        </span>
        <span className="selected">
          <GitBranch size={15} />
          Flow <span className="demo-count">3</span>
        </span>
        <span>
          <BookOpen size={15} />
          Academy
        </span>
        <span>
          <MessageSquare size={15} />
          Assist
        </span>
        <span>
          <BarChart3 size={15} />
          Insights
        </span>
        <div className="demo-sidebar-bottom">
          <span className="avatar tiny">LM</span>Lea Mustermann
        </div>
      </aside>
      <div className="demo-main">
        <div className="demo-top">
          <span>
            Arbeitsraum <span>/</span> Flow
          </span>
          <Badge tone="green">Interaktives Beispiel</Badge>
        </div>
        <div className="demo-heading">
          <div>
            <small>GUTE PROZESSE. GUTER START.</small>
            <h3>Kunden-Onboarding</h3>
            <p>Ein gemeinsamer Plan. Alles an seinem Platz.</p>
          </div>
          <span className="demo-spark">
            <GitBranch size={24} />
          </span>
        </div>
        <div className="demo-metrics">
          <div>
            <small>FORTSCHRITT</small>
            <strong>
              {Math.round((step / 3) * 100)} <span>%</span>
            </strong>
          </div>
          <div>
            <small>NÄCHSTER SCHRITT</small>
            <strong>
              {step === 3 ? "Geschafft." : `0${step + 1}`} <span>/ 03</span>
            </strong>
          </div>
          <div>
            <small>TEAM</small>
            <div className="avatar-stack">
              <span>LM</span>
              <span>TK</span>
              <span>+2</span>
            </div>
          </div>
        </div>
        <div className="demo-progress">
          <i style={{ width: `${(step / 3) * 100}%` }} />
        </div>
        <div className="demo-list">
          {demoSteps.map((title, i) => (
            <div
              key={title}
              className={`demo-row ${i === step ? "current" : ""}`}
            >
              <span className={`step-check ${i < step ? "checked" : ""}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </span>
              <div>
                <strong>{title}</strong>
                <small>
                  {i === 2
                    ? "Freigabe durch Management"
                    : "Aufgabe · Kunden-Onboarding"}
                </small>
              </div>
              <span className="demo-person">{i === 2 ? "TK" : "LM"}</span>
              <span className={`demo-state ${i < step ? "done" : ""}`}>
                {i < step ? "Erledigt" : i === step ? "In Arbeit" : "Wartet"}
              </span>
            </div>
          ))}
        </div>
        <div className="demo-bottom">
          <span>
            <span className="live-dot" />
            {step === 3
              ? "Gut gemacht. Der Ablauf ist abgeschlossen."
              : "Probieren Sie es aus. Ganz ohne Anmeldung."}
          </span>
          <button onClick={() => setStep(step === 3 ? 0 : step + 1)}>
            {step === 3 ? "Neu starten" : "Schritt abschließen"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
export function Marketing({
  config,
  campaign,
  mailMode = "local",
}: {
  config: ReturnType<typeof catalog>;
  campaign: Awaited<ReturnType<typeof campaignStatus>>;
  mailMode?: string;
}) {
  const [demo, setDemo] = useState(false),
    [joined, setJoined] = useState("");
  return (
    <>
      <MarketingNav />
      <main id="main">
        <section className="lyno-hero section">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="live-dot" /> EIN ARBEITSRAUM FÜR IHR UNTERNEHMEN
            </div>
            <h1>
              Weniger Abstimmung.
              <br />
              Mehr Fortschritt.
            </h1>
            <p>
              Prozesse, Wissen und Menschen gehören zusammen.
              <br />
              LYNO gibt Ihrem Team den Raum, sich auf gute Arbeit zu
              konzentrieren.
            </p>
            <div className="hero-actions">
              <LinkButton href="/registrieren">
                14 Tage kostenlos starten <ArrowUpRight size={16} />
              </LinkButton>
              <Button variant="secondary" onClick={() => setDemo(true)}>
                Produktdemo öffnen <Play size={13} />
              </Button>
            </div>
            <div className="hero-notes">
              Für IT-Dienstleister und Agenturen · Keine Kreditkarte
              erforderlich
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-caption">
              <span>LYNO / FLOW</span>
              <span>INTERAKTIVE PRODUKTVORSCHAU · BEISPIELDATEN</span>
            </div>
            <ProductDemo />
          </div>
        </section>
        <section className="section product-intro" id="produkt">
          <div className="section-label">
            <span>KLARHEIT IM TAGESGESCHÄFT</span>
            <span>FÜR TEAMS MIT 10–50 MENSCHEN</span>
          </div>
          <h2>
            Ihre Arbeit ist verbunden.
            <br />
            Ihre Software sollte es auch sein.
          </h2>
          <div className="value-columns">
            <article>
              <span>01</span>
              <h3>Ein Ort für den nächsten Schritt.</h3>
              <p>
                Aufgaben, Fristen und Freigaben bleiben dort, wo der Prozess
                stattfindet. Alle sehen, was als Nächstes ansteht.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Wissen bleibt im Unternehmen.</h3>
              <p>
                Anleitungen und Erfahrung werden Teil Ihrer Abläufe. Neue
                Kollegen finden Antworten, ohne bei null anzufangen.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Ein Rahmen, der zu Ihnen passt.</h3>
              <p>
                Module, Teams und Ansichten passen sich Ihrer Arbeit an. Mit
                getrennten Firmenkonten und bewusst vergebenen Rechten.
              </p>
            </article>
          </div>
        </section>
        <section className="section" id="module">
          <div className="section-label">
            <span>FÜNF MODULE. EIN ZUSAMMENHANG.</span>
            <span>CORE ALS GEMEINSAME BASIS</span>
          </div>
          <div className="module-rows">
            {products.map((m, i) => (
              <Link className="module-row" href={`/module/${m.id}`} key={m.id}>
                <span className="module-index">0{i + 1}</span>
                <h2>LYNO {m.name}</h2>
                <div>
                  <h3>{m.eyebrow}</h3>
                  <p>{m.description}</p>
                </div>
                <ArrowUpRight size={22} />
              </Link>
            ))}
          </div>
        </section>
        <section className="section use-cases" id="anwendungsfaelle">
          <div className="section-label">
            <span>AUS IHREM ALLTAG</span>
            <Link href="/anwendungsfaelle">Alle Anwendungsfälle →</Link>
          </div>
          <h2>
            Gute Abläufe machen
            <br />
            den Unterschied.
          </h2>
          <div className="use-case-grid">
            {[
              [
                "01",
                "Kunden-Onboarding",
                "Vom ersten Briefing bis zur freigegebenen Übergabe. Alle Schritte mit klarer Zuständigkeit.",
                "flow",
              ],
              [
                "02",
                "Qualitätsprüfung",
                "Die gleiche Sorgfalt bei jedem Auftrag. Prüfschritte, Nachweise und Wissen an einem Ort.",
                "flow",
              ],
              [
                "03",
                "Mitarbeitende einarbeiten",
                "Ein verständlicher Lernpfad, aktuelle Anleitungen und nachvollziehbarer Fortschritt.",
                "academy",
              ],
            ].map(([n, title, body, m]) => (
              <article key={n}>
                <span className="eyebrow">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <Link className="text-link" href={`/module/${m}`}>
                  Möglichkeiten entdecken →
                </Link>
              </article>
            ))}
          </div>
        </section>
        <Pricing config={config} campaign={campaign} />
        <section className="section faq-section" id="faq">
          <div>
            <span className="eyebrow">GUT ZU WISSEN</span>
            <h2>Klare Antworten.</h2>
            <Link className="text-link" href="/kontakt">
              Kontakt aufnehmen →
            </Link>
          </div>
          <div className="faq-list">
            {[
              [
                "Kann ich einzelne Module buchen?",
                "Ja. CORE ist die Basis. Flow, Academy, Assist und Insights lassen sich einzeln ergänzen. Bei allen vier Zusatzmodulen gilt der günstigere Bundle-Preis. Starter, Business und Premium unterscheiden sich in Limits und Funktionen.",
              ],
              [
                "Was enthält die Testphase?",
                "14 Tage Zugriff auf alle Module, ohne Kreditkarte. Anschließend gelten Ihre bestätigten Buchungen. Diese lokale Version verarbeitet ausschließlich simulierte Zahlungen oder Stripe-Testzahlungen.",
              ],
              [
                "Wie funktioniert der Startrabatt?",
                `${campaign.percent}% Rabatt für ${campaign.months} Monate, begrenzt auf die ersten ${campaign.capacity} erstmalig zahlenden Neukunden. Reservierungen sind gegen Überbuchung gesichert. Der angezeigte Zähler enthält ausschließlich Testvorgänge. Nach Ablauf gilt der reguläre Preis.`,
              ],
              [
                "Welche Daten sieht Assist?",
                "Assist verwendet nur Firmenwissen, das Ihre Rolle und Teammitgliedschaften freigeben. Ergebnisse enthalten Quellen. Entwürfe müssen vor dem Speichern geprüft werden. Ohne konfigurierte KI-API arbeitet Assist in einem gekennzeichneten extraktiven Testmodus.",
              ],
              [
                "Kann ich kündigen und Daten mitnehmen?",
                "Als Inhaber können Sie Ihr Abo zum Laufzeitende kündigen und Unternehmensdaten als JSON exportieren. Paketwechsel und Module verwalten Sie selbst in den Einstellungen.",
              ],
              [
                "Ist der kommerzielle Betrieb bereits freigegeben?",
                "Noch nicht. Betreiberangaben, Rechtstexte und externe Integrationen sowie Sicherheits- und Betriebsprüfungen müssen vor dem Launch abgeschlossen werden. Die Plattform ist lokal erprobbar.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={16} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="beta-section" id="beta">
          <div>
            <span className="eyebrow">
              GEMEINSAM DEN NÄCHSTEN SCHRITT MACHEN
            </span>
            <h2>
              Mehr Freiraum
              <br />
              für gute Arbeit.
            </h2>
            <p>
              Begleiten Sie LYNO auf dem Weg zur Beta.
              <br />
              Melden Sie Ihr Interesse unverbindlich an.
            </p>
          </div>
          <div className="beta-form">
            {joined ? (
              <div className="success" role="status">
                <CircleCheck />
                <h3>Ein guter Anfang.</h3>
                <p>{joined}</p>
              </div>
            ) : (
              <ActionForm
                submit="Für die Beta vormerken"
                onSubmit={async (fd) => {
                  const r = await api<{ message: string }>("waitlist", {
                    email: fd.get("email"),
                    company: fd.get("company"),
                    marketingConsent: fd.get("marketing") === "on",
                  });
                  setJoined(r.message);
                }}
              >
                <Field label="Geschäftliche E-Mail">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="sie@unternehmen.de"
                    required
                  />
                </Field>
                <Field label="Unternehmen">
                  <input
                    name="company"
                    autoComplete="organization"
                    placeholder="Ihr Unternehmen"
                    minLength={2}
                    required
                  />
                </Field>
                <label className="checkbox-label">
                  <input name="marketing" type="checkbox" />
                  <span>
                    Optional: Ich möchte zusätzlich Produktneuigkeiten und
                    Marketing-E-Mails erhalten. Diese Einwilligung kann ich
                    jederzeit widerrufen.
                  </span>
                </label>
                <small>
                  Die Beta-Anmeldung wird erst nach Bestätigung wirksam.{" "}
                  <Link href="/datenschutz">
                    Informationen zur Datenverarbeitung
                  </Link>
                  {mailMode === "smtp"
                    ? ". Bestätigungslinks werden per E-Mail versendet."
                    : ". Lokaler Testbetrieb ohne E-Mail-Versand."}
                </small>
              </ActionForm>
            )}
          </div>
        </section>
      </main>
      <MarketingFooter />
      {demo && (
        <Modal
          title="LYNO selbst ausprobieren"
          wide
          onClose={() => setDemo(false)}
        >
          <p className="notice mb">
            Interaktive lokale Vorschau mit fiktiven Beispieldaten. Für
            dauerhaft gespeicherte Abläufe starten Sie einen eigenen
            Testarbeitsraum.
          </p>
          <ProductDemo expanded />
        </Modal>
      )}
    </>
  );
}
export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-top">
        <div>
          <Logo />
          <p>Raum für gute Arbeit.</p>
        </div>
        <nav aria-label="Fußnavigation">
          <Link href="/#produkt">Produkt</Link>
          <Link href="/anwendungsfaelle">Anwendungsfälle</Link>
          <Link href="/#preise">Preise</Link>
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/anmelden">Anmelden</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} LYNO · Entwicklungsprojekt</span>
        <div>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>
        </div>
        <span>Mit Klarheit weiter.</span>
      </div>
    </footer>
  );
}
