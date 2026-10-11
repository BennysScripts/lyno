# LYNO – Entwicklungsplan

Stand: 11.10.2026. Die vollständigen Anforderungen und Abnahmen E01–E09 stehen in LYNO_SPEC.md. Bestehende Anwendung wird erweitert; bisherige Funktionen bleiben erhalten.

## Nachgewiesene Ausgangsbasis

Der Erstauftrag wurde lokal mit Next.js/PostgreSQL, fünf Modulen, Website und Testabrechnung umgesetzt. Letzter Baseline-Lauf: 30 Unit-/Integrationstests und 12 Desktop-/Mobil-E2E bestanden; Typecheck, Build, Format und Dependency-Audit bestanden. Diese Ergebnisse gelten für den bisherigen Stand und beweisen noch nicht die neue Erweiterung. Keine Produktionsfreigabe.

## Neue Meilensteine mit Abnahme

- [x] N0 Bestandsprüfung, vollständige Anforderungen, Open-Design-Sicherheitsprüfung und Designentscheidungen. Abnahme: E01, vollständige Feature-Matrix, dokumentierte Wiederverwendung und Skill-Entscheidung.
- [x] N1 Zentrale Pakete und sichere Modulberechtigungen. CORE + Starter/Business/Premium, Module/Bundles, Nutzer-/Automations-/KI-Limits. Abnahme E02: gleiche Konfiguration in Backend/Checkout/UI; erlaubte und verbotene Zugriffe getestet.
- [x] N2 Checkout, Abowechsel und Startrabatt – lokal und mit gemocktem Stripe-Transport geprüft. Signierte/idempotente Test-Webhooks, bestätigungsabhängige Freischaltung, Self-Service, transaktionssichere Reservierung für erste 20 zahlende Neukunden. E03/E04 einschließlich konkurrierender Käufe, abgelaufener Reservierung, wiederholter Events und Tarifwechsel. Externe Stripe-Abnahme bleibt N8.
- [x] N3 Firmenindividualisierung und CORE. Mandantengetrennte Logos/Farben/Branding, Dashboard/Widgets/Startseite, alle Moduloptionen, benutzerdefinierte Rollen, globale Suche, Benachrichtigungsregeln und gespeicherte Ansichten. Abnahme E05/E07 einschließlich erneuter Anmeldung, Fremdfirmenzugriff und Rechteeskalation.
- [x] N4 Fachmodule ergänzen. Academy-Dokumente/Lernpfade, Flow-Konfiguration/Automationen, Assist-Freigabe und paketabhängige Limits, Insights-Berichte. Abnahme E06/E07 und Regression vorhandener Abläufe.
- [x] N5 Einheitliches Design und Website. Dezente Typografie/Layouts, Light/Dark, responsive; fünf Modulseiten, Anwendungsfälle, echte interaktive Vorschau, Preise/Paketvergleich/Kaufwege/Rabattzähler. Sechs Referenzen berücksichtigt; E01/E08 auf drei Bildschirmgrößen geprüft.
- [ ] N6 Gesamtprüfung, Fehlerbehebung und Übergabe. Unit/Integration/Sicherheit/E2E, Desktop/Tablet/Smartphone, Typecheck/Build/Audit, Installationsanleitung und Launch-Checkliste aktualisieren, Quellcode sichern. Abnahme E09 und ehrliche Liste externer/offener Prüfungen.
- [ ] N7 Fortsetzung nach Windows-Zwischenstand: unabhängigen Git-Checkout auf Startfähigkeit prüfen, Wiederherstellung in isolierter Prüfdatenbank nachweisen und verbliebene Betriebsrisiken gezielt bearbeiten. Vorhandene Firmen unverändert erhalten.
- [ ] N8 Externe Abnahme: autorisierter Stripe-Testaccount, SMTP, OpenAI, echtes Windows/iOS, Last-/Ausfall-/Sicherheitsprüfung und rechtliche/betriebliche Freigaben. Benötigte Zugänge und Entscheidungen: docs/LAUNCH.md. Kein Live-Zahlungsmodus und kein produktives Deployment.

## Laufendes Arbeitsprotokoll

- N0 begonnen: Bestand gelesen; vorhandene Auth-, RLS-, Workflow-, Knowledge-, Assist-, Insights- und Mail-Services werden weitergenutzt. Neue Anforderungen vollständig in die Spezifikation übernommen; ältere Ziele bleiben verbindlich.
- Referenzbilder fehlen derzeit. Schriftliche Designvorgaben sind ausreichend für die erste Überarbeitung; Bildabgleich bleibt offen bis zur Bereitstellung.
- open-design wird zunächst nur gelesen; keine ungeprüften Installationsskripte oder automatischen externen Dienste.

## Teststatus

Erweiterungsstand am 11.10.2026: 47/47 Unit-/PostgreSQL-/Adaptertests und 24/24 Browserfälle auf Desktop/Tablet/Smartphone erfolgreich. Typecheck und finaler Standalone-Build bestanden; npm audit meldet 0 bekannte Schwachstellen. Details und Prüfgrenzen in docs/TEST_STATUS.md. Neue Erweiterungen werden nach Änderungen separat geprüft.

## Betriebs- und Freigabegrenzen

Keine echten Zahlungen, externen Nachrichten, Ausgaben, produktiven Deployments oder riskanten Änderungen vorhandener Nutzerdaten. Sämtliche Integrationen bleiben ausdrücklich im Testmodus. Für kommerziellen Betrieb fehlen weiterhin Betreiber-/Rechtsangaben, autorisierte Anbieterzugänge, SMTP-Domain, Hosting/TLS, Backup-Restore-Abnahme, Monitoring und unabhängige Sicherheits-/Last-/Geräteprüfung. Siehe docs/LAUNCH.md.

- N0 abgeschlossen: Textskill frontend-design aus gepinntem OpenDesign-Commit mit Lizenz installiert; Review in docs/OPEN_DESIGN_REVIEW.md. Keine zusätzliche Runtime. Anforderungen und Abnahmen vollständig gesichert. N1/N2 begonnen.

- Referenzbilder nachgereicht: sechs PNGs geprüft und gesichert. N5 auf Marine/Blau, zweispaltigen Hero, Wortmarke und prominente globale Suche ausgerichtet. docs/DESIGN.md dokumentiert den Abgleich.
- Zwischenprüfung vor Referenzabgleich: 41 Backend-Tests und 18 E2E-Fälle auf drei Bildschirmgrößen bestanden; sechs zusätzliche E2E-Prüfungen laufen. Build und Typecheck erfolgreich.
- N1–N5 lokal abgeschlossen: zentrale Pakete/Modulrechte, bestätigte Testzahlungen, Rabattsperre, Firmenanpassungen, Zusatzrollen, Dokumente/Lernpfade, Suche/Ansichten/CSV und Referenzdesign implementiert und geprüft. Stripe-Adapter mit lokal signierten Ereignissen und gemocktem Transport, keine Providerzugriffe.
- N6: 47 Backend-Tests bestanden. Der erste finale Browserlauf fand einen Kontrastfehler in einer Initialenmarke der Produktvorschau. Hintergrund korrigiert, neu gebaut, alle 24 Browserfälle erneut erfolgreich (1,3 Minuten). Aktuelle Desktop-/Mobil-/Dark-Mode-Screenshots gesichtet. Windows-Anleitung und dokumentierte Integrationsgrenzen aktualisiert.
- Windows-Übergabe läuft: Nutzer autorisiert Commit/Push auf https://github.com/BennysScripts/lyno, Branch codex/lyno-development. Lokale Geheimnisse, Postfach und Datenbankdaten bleiben ausgeschlossen; die Entwicklung wird nach Sicherung mit N7 fortgesetzt.
