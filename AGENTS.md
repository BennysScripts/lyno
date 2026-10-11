# LYNO – Arbeitsregeln

- Sprache der Anwendung und Dokumentation: Deutsch; technische Bezeichner Englisch.
- Next.js App Router, TypeScript strict, PostgreSQL, Tailwind. Kein Austausch von Persistenz durch Browser-Mocks.
- Jede geschützte Operation benötigt authentifizierte Session, aktuelle Mitgliedschaft, Rollenprüfung und Mandantenfilter. Fremde IDs ergeben 404. Tenant-Transaktionen setzen PostgreSQL-RLS-Kontext.
- Eingaben mit Zod validieren. Kein dynamisches SQL aus Benutzereingaben. Geheimnisse niemals in Clientcode oder Logs.
- Keine externen Nachrichten, echten Zahlungen oder produktiven Deployments. E-Mail lokal als Outbox, KI explizit im Testmodus, Abrechnung ausschließlich Testmodus.
- Jede Funktion erhält sinnvolle Fehler-, Leer- und Ladezustände. Alle sichtbaren Bedienelemente funktionieren.
- Nach abgeschlossenen Meilensteinen PLAN.md und docs/TEST_STATUS.md aktualisieren.
- Tests für Autorisierung und Mandantentrennung sind Abnahmekriterien. Vor Abschluss Typecheck, Integrationstests, Build und E2E ausführen.
- Keine erfundenen Kunden, Kennzahlen, Rechtstexte oder Anbieterangaben. Seed-Inhalte ausdrücklich als Beispieldaten markieren.
- Bestehende Nutzerdaten niemals löschen. Tests über `npm test` / `npm run test:e2e` verwenden eigene temporäre Datenbanken und Postfächer; keine Rate-Limits oder Rabattplätze in Arbeitsdatenbanken zurücksetzen; Kontolöschung nur per ausdrücklich bestätigter UI-Aktion.

## Design-Skill

Bei Oberflächenarbeit den lokal geprüften Skill `.agents/skills/open-design-frontend/SKILL.md` anwenden; Nutzervorgaben und LYNO-Designsystem haben Vorrang. Herkunft und Prüfgrenzen: docs/OPEN_DESIGN_REVIEW.md.

## Verbindliche Erweiterungsregeln

- LYNO_SPEC.md enthält den vollständigen Auftrag; keine Features oder Preisstrategien stillschweigend streichen. PLAN.md bildet Abnahmen und offene Punkte ab.
- Bestehenden Code gezielt erweitern. Zentrale Produktkonfiguration ist einzige Quelle für Preise, Pakete, Module und Limits. Modulrechte immer serverseitig prüfen.
- CORE ist Basis. Starter/Business/Premium sowie einzeln buchbare Zusatzmodule/Bundles unterstützen. Stripe strikt Testmodus; Zahlungsevents signiert und idempotent, Rechte erst nach Zahlungsbestätigung.
- Stripe-Schreibaufrufe erst nach Commit des dauerhaften Auftrags ausführen; unveränderliche Parameter/Idempotenzschlüssel, begrenztes Wiederholungsfenster und kanonischen Abgleich erhalten.
- Rabattplätze in PostgreSQL transaktionssicher reservieren/einlösen; Testzahlungen niemals als echte Kunden bewerben.
- Individualisierung, Rollen und Dokumente gehören immer zu einer Firma. Benutzerdefinierte Rollen dürfen keine höheren Rechte erzeugen.
- Design: klare Typografie, ruhige neutrale Flächen, dezente Akzente/Animationen; keine KI-Sternchen, dekorativen Symbolreihen, starken Verläufe oder überladenen Dashboards. Referenzbilder nicht erfinden.
- Fremde Skills zuerst auf Sicherheit/Lizenz/Kompatibilität prüfen. Keine ungeprüften Installer ausführen oder unnötige externe Infrastruktur hinzufügen.
- Referenzbilder und externe Abnahmen ehrlich als offen behandeln, solange sie fehlen. Neue Meilensteine nicht mit alten Testergebnissen als bestanden markieren.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
