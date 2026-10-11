import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-forms";
import { MarketingNav, MarketingFooter } from "@/components/marketing";
import { ContactForm } from "@/components/contact";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    robots: { index: ["kontakt"].includes(slug), follow: true },
  };
}
export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  if (
    [
      "registrieren",
      "anmelden",
      "passwort-vergessen",
      "passwort-neu",
      "bestaetigen",
      "einladung",
      "einrichten",
    ].includes(slug)
  )
    return (
      <AuthForm
        mode={slug}
        token={search.token}
        kind={search.type}
        plan={
          ["starter", "business", "premium"].includes(search.plan || "")
            ? search.plan
            : "starter"
        }
        modules={
          search.modules === undefined
            ? undefined
            : search.modules
                .split(",")
                .filter((m) =>
                  ["flow", "academy", "assist", "insights"].includes(m),
                )
        }
      />
    );
  if (slug === "kontakt")
    return (
      <>
        <MarketingNav />
        <main id="main" className="contact-page section">
          <div>
            <span className="eyebrow">LASSEN SIE UNS WEITERDENKEN</span>
            <h1>
              Gute Zusammenarbeit
              <br />
              beginnt mit einem
              <br />
              <em>Gespräch.</em>
            </h1>
            <p>
              Was beschäftigt Ihr Team? Erzählen Sie uns, welche Abläufe Sie
              klarer gestalten möchten.
            </p>
            <div className="notice">
              Lokale Testinstallation: Anfragen werden in Ihrer Datenbank
              gespeichert. Es wird keine Nachricht versendet.
            </div>
          </div>
          <ContactForm />
        </main>
        <MarketingFooter />
      </>
    );
  if (["impressum", "datenschutz", "nutzungsbedingungen"].includes(slug))
    return (
      <>
        <MarketingNav />
        <main id="main" className="legal-page">
          <span className="eyebrow">TRANSPARENZ IM ENTWICKLUNGSSTAND</span>
          <h1>
            {slug === "impressum"
              ? "Impressum"
              : slug === "datenschutz"
                ? "Datenschutzhinweise"
                : "Nutzungsbedingungen"}
          </h1>
          <div className="notice">
            Noch nicht für den kommerziellen Einsatz freigegeben. Dies ist kein
            rechtsgeprüfter Rechtstext.
          </div>
          {slug === "impressum" ? (
            <>
              <h2>Betreiberangaben ausstehend</h2>
              <p>
                {process.env.LEGAL_COMPANY ||
                  "Ein rechtlicher Anbieter wurde noch nicht hinterlegt."}
              </p>
              {process.env.LEGAL_ADDRESS && <p>{process.env.LEGAL_ADDRESS}</p>}
              {process.env.LEGAL_EMAIL && <p>{process.env.LEGAL_EMAIL}</p>}
              <p>
                Vor Veröffentlichung müssen verantwortlicher Anbieter,
                ladungsfähige Anschrift, Kontakt, gegebenenfalls
                Vertretungsberechtigte und Register-/Umsatzsteuerangaben ergänzt
                und geprüft werden.
              </p>
            </>
          ) : slug === "datenschutz" ? (
            <>
              <h2>Was diese lokale Anwendung verarbeitet</h2>
              <p>
                Namen, E-Mail-Adressen, Passwort-Hashes, Firmenzugehörigkeiten,
                Aufgaben, Wissensartikel, Kommentare und Audit-Ereignisse werden
                in PostgreSQL gespeichert. Ein technisch notwendiges
                HttpOnly-Cookie hält die Anmeldung bis zu sieben Tage aufrecht.
                Die Darstellungspräferenz wird lokal im Browser gespeichert.
              </p>
              <h2>Testdienste und Datenflüsse</h2>
              <p>
                Nachrichten werden standardmäßig in einem lokalen Dateipostfach
                abgelegt. Optional kann ein ausdrücklich konfigurierter
                SMTP-Dienst den Versand übernehmen. Assist nutzt im Testmodus
                ausschließlich lokale Auszüge. Eine externe KI-Verarbeitung muss
                ausdrücklich konfiguriert werden. Zahlungen sind ausschließlich
                im Testmodus implementiert. Es gibt keine eingebauten
                Marketingtracker oder extern geladenen Schriftarten.
              </p>
              <h2>Vor dem Launch zu ergänzen</h2>
              <p>
                Verantwortlicher, konkrete Rechtsgrundlagen,
                Auftragsverarbeiter, Speicherfristen, Löschkonzept
                einschließlich Backups, Drittlandtransfers, Kontakt für
                Betroffenenrechte und zuständige Aufsichtsbehörde müssen anhand
                des tatsächlichen Betriebs juristisch geprüft werden.
              </p>
            </>
          ) : (
            <>
              <h2>Erprobung ohne kommerziellen Vertragsschluss</h2>
              <p>
                Diese Installation dient der lokalen Erprobung. Pakete,
                Testphase und Abonnements bilden technische Abläufe ab. Es
                werden keine echten Zahlungen eingezogen.
              </p>
              <h2>Vertragsunterlagen ausstehend</h2>
              <p>
                Leistungsbeschreibung, verbindliche Preise, Laufzeiten, Haftung,
                Support, Auftragsverarbeitung und Vertragsabschluss müssen vor
                einem kommerziellen Angebot festgelegt und rechtlich geprüft
                werden.
              </p>
            </>
          )}
        </main>
        <MarketingFooter />
      </>
    );
  notFound();
}
