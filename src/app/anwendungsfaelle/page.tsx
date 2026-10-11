import Link from "next/link";
import { MarketingNav, MarketingFooter } from "@/components/marketing";
export const metadata = {
  title: "Anwendungsfälle für IT-Dienstleister und Agenturen",
  description:
    "Kunden-Onboarding, Qualität, Freigaben und Einarbeitung mit LYNO organisieren.",
};
export default function UseCases() {
  return (
    <>
      <MarketingNav />
      <main id="main" className="section use-case-page">
        <span className="eyebrow">FÜR IHREN ARBEITSALLTAG</span>
        <h1>
          Wiederkehrende Arbeit.
          <br />
          Verlässlich organisiert.
        </h1>
        <p>
          Starten Sie mit einer Vorlage und passen Sie Schritte, Formulare und
          Zuständigkeiten an Ihr Unternehmen an.
        </p>
        {[
          [
            "Kunden-Onboarding",
            "Briefing → Zugänge → Übergabe",
            "Erfassen Sie Anforderungen in einem Formular. Bedingungen steuern, welche Schritte nötig sind. Vor dem Abschluss bestätigt eine berechtigte Person die Übergabe.",
            "flow",
          ],
          [
            "Qualitätsprüfung",
            "Prüfumfang → Kontrolle → Freigabe",
            "Definieren Sie wiederholbare Prüfungen, verknüpfen Sie die interne Anleitung und halten Sie Rückfragen im Prozessverlauf fest.",
            "flow",
          ],
          [
            "Interne Freigaben",
            "Antrag → Prüfung → Entscheidung",
            "Machen Sie aus Anträgen nachvollziehbare Vorgänge. Fristen und Freigaberechte sorgen für einen verlässlichen Rahmen.",
            "flow",
          ],
          [
            "Mitarbeitende einarbeiten",
            "Orientierung → Wissen → Praxis",
            "Kombinieren Sie Artikel zu Lernpfaden. Der persönliche Fortschritt zeigt, welche Schritte abgeschlossen sind. Ergänzende Aufgaben laufen in Flow.",
            "academy",
          ],
        ].map(([title, steps, text, module], i) => (
          <article className="use-case-detail" key={title}>
            <span className="module-index">0{i + 1}</span>
            <div>
              <h2>{title}</h2>
              <p className="case-steps">{steps}</p>
              <p>{text}</p>
              <Link className="text-link" href={`/module/${module}`}>
                Passendes Modul ansehen →
              </Link>
            </div>
          </article>
        ))}
        <Link className="button" href="/registrieren">
          Eigenen Arbeitsraum starten →
        </Link>
      </main>
      <MarketingFooter />
    </>
  );
}
