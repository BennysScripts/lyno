# LYNO

Lokal ausführbare B2B-Plattform für Prozesse, Firmenwissen und Zusammenarbeit. Next.js 16, React 19, TypeScript, Tailwind CSS und PostgreSQL 17. Deutsche Oberfläche, fünf Produktmodule und öffentliche Marketing-Website.

**Entwicklungsstand, keine produktive oder rechtliche Freigabe.** E-Mails werden lokal abgelegt; Assist läuft standardmäßig ohne externen KI-Dienst; Abrechnung ausschließlich im Testmodus. Die mitgelieferten Anbieter-/Rechtsseiten weisen fehlende Angaben ausdrücklich aus.

## Lokal starten

**Windows/PowerShell:** vollständige Erstinstallation, lokale Datenbank, Updates und Fehlerhilfe in [docs/WINDOWS.md](docs/WINDOWS.md). Repository: [BennysScripts/lyno](https://github.com/BennysScripts/lyno), Entwicklungsbranch `codex/lyno-development`.

Voraussetzungen: Node.js 22.12+ (hier mit 24.19 geprüft), npm, Docker mit Compose. Port 3000 und 5432 frei.

```bash
cd /pfad/zu/lyno
npm ci
cp .env.example .env
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:local
```

Öffnen: [http://localhost:3000](http://localhost:3000). Die Website ist öffentlich; die Anwendung unter `/app` verlangt eine Anmeldung. `APP_URL` muss genau dem Browser-Origin entsprechen. Beim Zugriff über eine andere Adresse entsprechend ändern und Server neu starten.

Beispielkonto nach dem optionalen Seed:

- E-Mail: `lea@lyno.example`
- Passwort: `Lyno-Demo-2026!`
- Weitere Rollen: `tim@lyno.example` (Management), `mira@lyno.example` (Mitglied), `eva@lyno.example` (lesend), jeweils dasselbe **nur lokale** Testpasswort.
- „Nordlicht Studio“ und sämtliche Seed-Prozesse sind ausdrücklich fiktive Beispieldaten. `db:seed` ist wiederholbar und verändert ein vorhandenes Beispielkonto nicht.

Alternativ direkt registrieren. Eine neue Firma erhält drei echte, bearbeitbare Prozessvorlagen und einen Startartikel. Keine erfundenen Unternehmenskennzahlen werden hinzugefügt.

## Lokales E-Mail-Postfach

Bestätigungen, Einladungen und Passwortreset-Links liegen unter `.local/mail/*.json` (Verzeichnis 0700, Dateien 0600, nicht versioniert). Es gibt absichtlich keinen öffentlichen Postfach-Endpunkt. Ein optionaler SMTP-Adapter mit verschlüsselter Outbox ist vorhanden und bleibt ohne explizite Konfiguration deaktiviert; Einrichtung siehe Betriebsdokumentation. Öffnen Sie die passende Datei lokal und folgen Sie dem enthaltenen Link. Der CLI-Aufruf `npm run mailbox -- ihre@email.de` zeigt ausschließlich Nachrichten dieses Empfängers. Diese Dateien enthalten Zugangstoken und gehören weder in Git noch in Support-Tickets.

- Registrierung: E-Mail-Link in `/bestaetigen` aktiv bestätigen.
- Einladung: Mit exakt dieser E-Mail registrieren/anmelden, E-Mail bestätigen, dann den Einladungslink öffnen und annehmen. Der ursprüngliche Arbeitsraum bleibt als eigenständiges Unternehmen erhalten.
- Passwortreset: 30 Minuten gültig, einmalig; setzt alle Sessions dieses Kontos außer Kraft.

## Hintergrundaufgaben

```bash
npm run jobs
```

Den Befehl im späteren Betrieb regelmäßig, z. B. jede Minute, ausführen. Er startet fällige Wiederholungen, erzeugt In-App-Erinnerungen und verarbeitet lokale Abo-Laufzeiten. PostgreSQL-Sperren und eindeutige Erinnerungsschlüssel verhindern Doppelverarbeitung. Pflichtfelder wiederkehrender Vorlagen benötigen Standardwerte. Nach einer Betriebspause wird ein versäumter Wiederholungstermin nachgeholt, nicht eine ganze Serie historischer Vorgänge.

## Prüfungen

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Integrationstests brauchen die migrierte lokale Datenbank und beide Verbindungsrollen aus `.env`. Sie legen eigene, zufällig benannte Testfirmen an; der Integrationstest entfernt ausschließlich seine eigenen Fixtures. E2E-Tests erzeugen zusätzliche klar erkennbare Testfirmen. **Niemals gegen eine Produktionsdatenbank ausführen.**

Playwright verwendet auf dieser Umgebung `/usr/bin/chromium`. Auf anderen Rechnern entweder `CHROMIUM_PATH` auf einen installierten Chromium-Browser setzen oder `npx playwright install chromium` ausführen. Ohne System-Chromium verwendet die Konfiguration automatisch den Playwright-Browser. Mobile Tests verwenden einen Chromium-Browser mit Smartphone-Viewport und Touch-Eingabe, kein echtes iOS/Safari-Gerät.

Den dokumentierten Abnahmestand finden Sie in [docs/TEST_STATUS.md](docs/TEST_STATUS.md). Browserbilder liegen unter `docs/screenshots/`, der lokale ausführliche Bericht in `playwright-report/`.

## Produktionsbuild lokal prüfen

```bash
npm run build
npm start
```

`npm start` startet das vorbereitete Standalone-Bundle in `.next/standalone`. Der Build kopiert öffentliche und statische Assets und entfernt ausschließlich generierte Kopien von `.env` und lokalem Postfach aus dem Bundle; die Originale bleiben bestehen. Installation und Dienstkonfiguration siehe [docs/OPERATIONS.md](docs/OPERATIONS.md). Es wurde nichts produktiv bereitgestellt.

## Aufbau

- `src/app/`: App Router, öffentliche Seiten, geschützter Arbeitsraum, API.
- `src/components/`: Designsystem und fachlich getrennte App-Oberflächen.
- `src/lib/`: Auth, Autorisierung, Datenbank, Flow, Academy, Assist, Insights, Core, Billing und Jobs.
- `migrations/`: versionierte PostgreSQL-DDL und RLS.
- `scripts/`: Migration, Seed, Job-Worker, lokales Postfach und QA.
- `tests/`: Unit-, reale PostgreSQL-Integrations- und Playwright-E2E-Tests.
- `.github/workflows/quality.yml`: vorbereitete CI mit PostgreSQL, Build und Browserprüfung (hier nicht auf GitHub ausgeführt).
- `LYNO_SPEC.md`, `PLAN.md`, `AGENTS.md`: Spezifikation, Meilensteine und Arbeitsregeln.

Details: [Architektur](docs/ARCHITECTURE.md), [Betrieb](docs/OPERATIONS.md), [Launch-Vorbereitung](docs/LAUNCH.md).

## Enthaltener Funktionsstand

CORE mit Firmen, Teams, Einladungen, Rollen, Audit, Export und bestätigter Löschung; FLOW mit Vorlageneditor, Formularen, Bedingungen, Freigaben und Wiederholungen; ACADEMY mit Artikeln, geschützten Dokumenten und geordneten Lernpfaden; ASSIST mit Quellen, Kontingenten und überprüfbaren Entwürfen; INSIGHTS mit echten Prozessstatistiken und CSV-Berichten.

Firmenbranding, Startseite, Dashboard-Widgets, Moduloptionen, Benachrichtigungen, Ansichten und zusätzliche Rollen werden mandantengetrennt gespeichert. CORE ist Basis; Starter/Business/Premium, einzelne Zusatzmodule und Bundles verwenden eine zentrale Konfiguration. Lokale Testbestätigung und Stripe-Testadapter teilen sich die serverseitigen Berechtigungen. Der Rabattzähler basiert auf tatsächlichen Testreservierungen und Testkäufen, nicht auf echten zahlenden Kunden.

Diese Beschreibung ersetzt keine Produktionsabnahme. Der aktuelle Prüfumfang und die offenen Integrationen stehen im Prüfprotokoll und in der Launch-Checkliste.
