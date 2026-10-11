# LYNO unter Windows lokal testen

Repository: https://github.com/BennysScripts/lyno

Entwicklungsbranch: `codex/lyno-development`. Dieser Branch enthält die jeweils gesicherten Entwicklungsstände. Cloud und PC verwenden **getrennte Datenbanken**; Git überträgt ausschließlich Quellcode und dokumentierte Beispieldaten.

## Voraussetzungen

- Windows 10/11, Git für Windows, Node.js 24 LTS inklusive npm.
- Docker Desktop mit WSL2 und Linux-Containern, bereits gestartet. Die lokale Nutzung muss zu Ihren Docker-Lizenzbedingungen passen; alternativ ist eine eigene lokale PostgreSQL-17-Installation möglich.
- Freie lokale Ports 3000 und 5432, Internetzugang zum erstmaligen Laden der Abhängigkeiten und des PostgreSQL-Images.
- PowerShell im gewünschten Projektverzeichnis. Bei einem privaten Repository benötigt Git Zugriff mit Ihrem GitHub-Konto.

`npm.cmd`/`npx.cmd` umgehen die häufige PowerShell-Sperre für `npm.ps1`; eine Änderung der Execution Policy ist nicht nötig. Die Befehle laufen nativ in PowerShell, nicht innerhalb eines Docker-Containers.

## Erstinstallation

```powershell
git clone --branch codex/lyno-development --single-branch https://github.com/BennysScripts/lyno.git
cd lyno
Copy-Item .env.example .env
npm.cmd ci
docker compose up -d --wait db
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev:local
```

Öffnen: http://localhost:3000. Website: `/`; Unternehmenssoftware: `/app`. Der Webserver und die Datenbank sind nur an Loopback gebunden. Dieses Terminal geöffnet lassen; mit `Strg+C` stoppen.

Beispielkonto: **lea@lyno.example**, Passwort **Lyno-Demo-2026!**. Das Beispielunternehmen und seine Daten sind ausdrücklich fiktiv. Der Seed ist optional und wiederholbar; vorhandene Beispielkonten werden nicht zurückgesetzt. Alternativ eine eigene lokale Testfirma über „Registrieren“ erstellen.

## Datenbank und Umgebungsvariablen

Die Datei `.env.example` enthält bereits alle Werte für den lokalen Start. Sie wird einmal nach `.env` kopiert; `.env` ist von Git ausgeschlossen. Keine Stripe-, OpenAI- oder SMTP-Zugangsdaten erforderlich.

| Variable                   | Lokaler Wert / Zweck                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `APP_URL`                  | `http://localhost:3000`; genau diese Adresse im Browser verwenden                                    |
| `DATABASE_URL`             | `postgres://lyno_app:lyno_local_app@127.0.0.1:5432/lyno`; eingeschränkte Anwendungsrolle             |
| `MIGRATION_DATABASE_URL`   | `postgres://lyno:lyno_local_dev@127.0.0.1:5432/lyno`; lokale Migrationen, Seed und Integrationstests |
| `DB_APP_PASSWORD`          | `lyno_local_app`; wird bei Migration für die Anwendungsrolle gesetzt                                 |
| `MAIL_MODE`                | `local`; Nachrichten werden als Dateien gespeichert, nicht versendet                                 |
| `ASSIST_MODE`              | `test`; ausdrücklich gekennzeichneter lokaler Modus ohne KI-API-Aufruf                               |
| `BILLING_MODE`             | `test`; Testabrechnung, ohne Stripe-Schlüssel lokal bestätigbar                                      |
| `LYNO_BIND_HOST`           | `127.0.0.1`; Bind-Adresse des gebauten Webservers                                                    |
| `ALLOW_INSECURE_LOCALHOST` | `true`; erlaubt HTTP-Cookies ausschließlich für lokale Build-Prüfung                                 |
| `NEXT_TELEMETRY_DISABLED`  | `1`                                                                                                  |

PostgreSQL **17**, Datenbank **lyno**, Port **5432**. Compose erstellt den administrativen Benutzer `lyno` mit dem lokalen Passwort `lyno_local_dev`; Migrationen erstellen die eingeschränkte Rolle `lyno_app` und alle Tabellen. Die Daten bleiben im Docker-Volume `lyno_pgdata` erhalten. Das Projekt benötigt weder Redis noch eine Cloud-Datenbank.

Die `PRICE_*_EUR`-Werte in `.env.example` steuern die Testpreise für CORE, Zusatzmodule und Bundles. Feature-Limits stehen zentral in `src/lib/catalog.ts`. Rabattregeln werden in PostgreSQL gespeichert; `npm.cmd run campaign -- show` zeigt die Konfiguration. Details: [Abrechnung und Betrieb](OPERATIONS.md).

Falls Sie PostgreSQL selbst installieren: Datenbank `lyno` und einen lokalen Migrationsbenutzer mit Berechtigung zur Rollenerstellung bereitstellen, `MIGRATION_DATABASE_URL` anpassen; `DATABASE_URL` weiterhin mit der durch die Migration angelegten eingeschränkten Rolle verwenden. Den Compose-Schritt dann auslassen.

## Registrierung, Einladungen und Passwortreset testen

In einem zweiten PowerShell-Fenster im Projektverzeichnis:

```powershell
npm.cmd run mailbox -- ihre-testadresse@example.com
```

Den ausgegebenen Bestätigungs-/Einladungs-/Reset-Link lokal im Browser öffnen. Nur die Nachrichten der angegebenen Adresse werden ausgegeben. Die Dateien unter `.local/mail` enthalten Einmaltoken und gehören nicht in Git oder geteilte Screenshots.

Die 14-tägige Testphase schaltet alle Module frei. Für ein lokales Testabo die eigene E-Mail bestätigen, unter „Paket & Abrechnung“ eine Auswahl treffen und die Testzahlung ausdrücklich bestätigen. Keine echte Zahlung findet statt. Stripe bleibt ohne Testschlüssel deaktiviert; ein Browser-Redirect allein aktiviert keine bezahlten Rechte.

Fällige Erinnerungen und wiederkehrende Prozesse verarbeiten:

```powershell
npm.cmd run jobs
```

Der Befehl verarbeitet einmal die fälligen Aufgaben; für längere Tests bei Bedarf erneut starten.

## Später erneut starten oder aktualisieren

Erneut starten:

```powershell
cd C:\Ihr\Projektpfad\lyno
docker compose up -d --wait db
npm.cmd run dev:local
```

Für einen neueren Cloud-Entwicklungsstand zuerst den Webserver mit `Strg+C` stoppen. Eigene Codeänderungen vorher committen; Git überschreibt sie nicht ungefragt. Dann:

```powershell
git pull --ff-only origin codex/lyno-development
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev:local
```

Die bestehende `.env` behalten, neue Beispielvariablen bei Bedarf ergänzen. Die Datenbank vor zukünftigen Migrationen sichern. `docker compose stop` stoppt PostgreSQL und erhält die Daten. Keine Volumes löschen.

## Gebauten Stand und Tests prüfen

Vor Änderungen können Sie die lokale Compose-Datenbank sichern und die Wiederherstellung in eine **neue** Datenbank prüfen:

```powershell
npm.cmd run db:backup -- .local/backups/vor-update.dump
npm.cmd run db:restore -- .local/backups/vor-update.dump lyno_restore_pruefung_01
```

Immer einen neuen Datei- bzw. Datenbanknamen wählen. Vorhandene Ziele werden abgewiesen; `lyno` kann niemals Restore-Ziel dieses Werkzeugs sein. Der binäre Dump wird ohne PowerShell-Ausgabeumleitung geschrieben und erhält eine SHA-256-Metadatendatei. Beide Dateien zusammen aufbewahren. Ein Hash erkennt Beschädigung, verschlüsselt die Daten aber nicht. Für echte Firmendaten zusätzlich verschlüsselten Speicher und Windows-Dateiberechtigungen vorsehen. Globale PostgreSQL-Rollen, `.env` und lokales Postfach sind nicht Teil des Datenbank-Dumps. Die Werkzeuge verwenden den bereits eingerichteten Compose-Dienst `db` mit Benutzer/Datenbank `lyno`; eigene PostgreSQL-Installationen benötigen native PostgreSQL-Sicherungswerkzeuge.

Statt Entwicklungsserver:

```powershell
npm.cmd run build
npm.cmd start
```

Für die Browserprüfung zuerst laufende LYNO-Webserver stoppen, damit der Test den gebauten Stand selbst startet:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
$env:E2E_PRODUCTION = "1"
npm.cmd run test:e2e
Remove-Item Env:E2E_PRODUCTION
```

Tests benötigen die lokale migrierte und für E2E gesäte Testdatenbank. Sie erzeugen zusätzliche Testfirmen. Niemals gegen produktive Datenbanken ausführen. Prüfprotokoll: [TEST_STATUS.md](TEST_STATUS.md).

## Häufige Startprobleme

- Docker nicht erreichbar: Docker Desktop vollständig starten, Linux-Container/WSL2 prüfen; `docker compose ps` zeigt den Zustand.
- Port 5432 belegt: anderen PostgreSQL-Dienst stoppen oder Compose-Port und beide Datenbank-URLs gemeinsam ändern. Keine vorhandene Datenbank löschen.
- Port 3000 belegt: anderen lokalen Webserver stoppen; bei anderem Port auch `APP_URL` anpassen. E2E erwartet Port 3000.
- Datenbankanmeldung schlägt fehl: `.env` und tatsächlich beim ersten Erstellen des Volumes gesetztes Passwort vergleichen. Ein später geändertes Compose-Passwort verändert keine bestehende PostgreSQL-Rolle.
- `EPERM` beim Standalone-Build: Node kann unter Windows für Paket-Symlinks den Windows-Entwicklermodus benötigen. Der normale Entwicklungsserver bleibt über `dev:local` nutzbar.
- Origin-Fehler: `http://localhost:3000` verwenden; `http://127.0.0.1:3000` ist ein anderer Origin.

Die Anwendung wurde in Linux/Chromium geprüft. Die PowerShell-Befehle sind für Windows vorbereitet; ein tatsächlicher Windows-/Docker-Desktop-Test steht noch aus. Externe Stripe-, SMTP- und OpenAI-Integrationen sowie Betriebs- und Rechtsfreigaben bleiben offen. Es erfolgt kein produktives Deployment.
