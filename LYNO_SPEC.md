# LYNO – Produktspezifikation

Stand: 11.10.2026. Zielgruppe: deutsche IT-Dienstleister und Agenturen mit 10–50 Mitarbeitenden.

## Ziel und Architektur

Eine lokal installierbare B2B-SaaS mit öffentlicher Website und mandantenfähiger Unternehmenssoftware. Next.js/React, TypeScript strict, Tailwind, PostgreSQL, pg, Zod, bcryptjs, Recharts, React Markdown, Vitest und Playwright. Modularer Monolith mit serverseitigen Services, HTTP-API, SQL-Migrationen und einem separat ausführbaren Job-Worker. Keine produktive Freigabe durch dieses Projekt.

## Module und Abnahme

- CORE: Registrierung mit Firma und 14 Tagen Testphase, E-Mail-Bestätigung, Login/Logout, Einmal-Passwortreset, gehashte zeitbegrenzte Sessions, Firmenwechsel, Profile, Firmen-Onboarding, Teams, rollenbasierte Mitgliedschaften, Einladungen, Benachrichtigungen, Audit, JSON-Export, bestätigte Löschung. Owner/Admin/Manager/Member/Viewer sind serverseitig durchgesetzt; letzter Owner bleibt erhalten.
- FLOW: Vorlageneditor mit sortierten Schritten, Pflichtformularen, bedingten Schritten, Freigabeschritten und Wissensverknüpfung. Laufende Prozesse mit Aufgaben, Zuständigkeit, Priorität, Fälligkeit, Kommentaren und Verlauf. Suche/Filter; Wiederholung und Erinnerungen über idempotenten Worker. Startbare Vorlagen Kunden-Onboarding, Qualitätsprüfung, interne Freigabe.
- ACADEMY: Kategorien, Markdown-Editor und sichere Vorschau, Suche, Firmen-/Team-/Manager-Sichtbarkeit, persönliche Einarbeitungschecklisten und Flow-Verknüpfung. Berechtigungsfilter gelten auch für KI und Export.
- ASSIST: erlaubtes Firmenwissen wird serverseitig selektiert. Antworten/Summen mit nachvollziehbaren Quellen; prüfbare Entwürfe werden erst nach Nutzeraktion zu Vorlagen. Limit pro Unternehmen/Tag; Timeout/Fehlerfälle. Ohne explizit aktivierten Anbieter lokaler, klar gekennzeichneter extraktiver Testmodus.
- INSIGHTS: Zählungen, Abschlussquote, Durchlaufzeit, überfällige Aufgaben und Engpässe aus der Datenbank; Datumsfilter und Diagramme. Leere Daten bleiben leer. Beispielmandant gekennzeichnet.
- Vertrieb: konfigurierbare Preise/Pakete, Warteliste mit Double-Opt-in und unabhängiger Marketing-Einwilligung, Kontaktanfrage, selbstständiges Firmen-Onboarding, Testphase, Testabo, Kündigung zum Laufzeitende. Keine echten Zahlungen. Anbieterrechtstexte bleiben als ausstehend markiert.
- Website: Hero, Module, Vorteile, interaktive lokale Prozessdemo, Preise, FAQ, Kontakt, Beta-Anmeldung; Metadaten, Sitemap, mobile Layouts, helle/dunkle Darstellung, Tastaturbedienung und reduzierte Animation.

## Daten- und Sicherheitsmodell

Tenant-ID auf sämtlichen Unternehmensressourcen, zusammengesetzte Fremdschlüssel für Beziehungen und PostgreSQL Row Level Security auf Fachdaten. Global: Nutzer, Sessions, Einmaltoken und öffentliche Anmeldungen. Jede API liest Mitgliedschaft neu; fremde Ressourcen sind unsichtbar. HttpOnly/SameSite-Cookies, Secure in HTTPS-Betrieb, Origin-Schutz für Schreiboperationen, zentrale Validierung, persistente Drosselung, bcrypt-Hashes, SHA-256-Tokenhashes, keine Passwörter/Token im Audit. Transaktionale Statusänderungen und Einladungsannahme. KI-Kontext wird als nicht vertrauenswürdiger Inhalt behandelt.

## Betriebsgrenzen

Standardmäßig werden E-Mails nur im lokalen Dateipostfach abgelegt; es wird nichts versendet. Der optionale SMTP-Adapter verwendet eine verschlüsselte Outbox, TLS und Wiederholungsversuche und wurde ausschließlich mit Mock-Transport geprüft. KI-API und Stripe-Testintegration sind ohne Zugangsdaten nicht extern abgenommen. Vor kommerziellem Betrieb: Betreiberangaben, juristisch geprüfte Vertrags-/Datenschutztexte, AVV, Versanddomain/SMTP, Hosting/Backup/Monitoring, unabhängige Sicherheitsprüfung, konfigurierte Anbieter und End-to-End-Prüfung erforderlich.

## Verbindlicher Erweiterungsauftrag vom 11.10.2026 (vollständig)

Entwickle LYNO zu einer professionellen B2B-SaaS-Plattform mit Website, fünf Modulen, Firmenverwaltung und Abos. Prüfe bestehenden Code und entwickle ihn weiter statt unnötig neu zu bauen.

DESIGN: Nutze meine Referenzbilder. Prüfe https://github.com/nexu-io/open-design auf Sicherheit und Kompatibilität; installiere den Skill bei Eignung. Wie Linear/Stripe: Typografie, klare Layouts, dezente Farben/Animationen, Light/Dark Mode, responsive. Keine KI-Icons, bunten Symbolreihen, starken Verläufe oder überladenen Dashboards. Einheitliches Designsystem.

WEBSITE: Premium-Landingpage, echte interaktive Produktvorschau, Modulseiten mit Funktionen und Kaufoptionen, Anwendungsfälle, Preise, Paketvergleich, FAQ, Registrierung, Beta-Anmeldung und Firmen-Onboarding. Keine erfundenen Referenzen oder Zahlen.

MODULE:
CORE: Dashboard, Firmenkonten, Mitarbeiter, Teams, Rollen/Rechte, Benachrichtigungen, Profile, Einstellungen und Suche.
FLOW: Prozesseditor, Vorlagen, Aufgaben, Formulare, Bedingungen, Freigaben, Zuständige, Fristen, Erinnerungen, wiederkehrende Workflows.
ACADEMY: Artikel, Dokumente, Kategorien, Suche, Lernpfade, Onboarding und interne Anleitungen.
ASSIST: KI zu berechtigtem Firmenwissen mit Quellen, Zusammenfassungen und Prozessvorschlägen; Datenänderungen nur nach Berechtigungsprüfung und Freigabe.
INSIGHTS: Dashboards mit realen Kennzahlen, Engpässen, Aufgabenstatistiken, Zeitreihen, Filtern und Berichten.

Ergänze selbstständig sinnvolle Funktionen mit Kundennutzen.

CUSTOMIZATION: Je Firma Logo, Farben, Branding, Dashboards, Widgets, Startseite, Formulare, Prozesse, Automationen, Ansichten, Rollen, Teams und Benachrichtigungen anpassbar. Jedes Modul individualisierbar; Einstellungen dauerhaft mandantengetrennt speichern.

PAKETE: CORE als Basis, FLOW/ACADEMY/ASSIST/INSIGHTS einzeln oder in Bundles buchbar. Starter, Business, Premium mit gestaffelten Features und Limits für Nutzer, Automationen und KI. Preise, Pakete und Berechtigungen zentral konfigurierbar.

CHECKOUT: Kunden registrieren Firma, buchen Paket/Module und erhalten nach bestätigter Zahlung automatisch Zugriff. Upgrades, Downgrades, Zusatzmodule, Kündigung, Zahlungsstatus und Self-Service. Stripe vorerst nur im Testmodus. Webhooks absichern und idempotent verarbeiten; Premium-Rechte serverseitig prüfen.

STARTRABATT: Konfigurierbarer Rabatt für die ersten 20 zahlenden Neukunden mit dynamischem Restplatzzähler aus echten Datenbankwerten. Reservierung/Kauf transaktionssicher, keine Überbuchung. Rabattregeln transparent und administrierbar.

ARCHITEKTUR: Wartbare Multi-Tenant-Lösung mit PostgreSQL, sicherer Authentifizierung, serverseitiger Autorisierung, isolierten Firmendaten und gemeinsamem Account-, Rechte- und Abrechnungssystem. Performance, Backups, Monitoring und Datenschutz beachten.

QUALITÄT: Keine Platzhalter oder funktionslosen Buttons. Prüfe alle zentralen Nutzerwege, Formulare, Dialoge, APIs, Rollen und Workflows mit Unit-, Integrations-, Sicherheits- und E2E-Tests. Teste die UI wenn möglich im Browser auf Desktop, Tablet und Smartphone. Fehler beheben, Tests wiederholen; fehlende Live-Integrationen klar kennzeichnen.

ARBEITSWEISE: Selbstständig in prüfbaren Meilensteinen arbeiten. LYNO_SPEC.md, PLAN.md und AGENTS.md erstellen/aktualisieren; Entscheidungen, Fortschritt, Tests und Blocker dokumentieren. Nach jedem Meilenstein weiterarbeiten. Nur bei Blockern/Entscheidungen nachfragen. Keine Ausgaben, echten Zahlungen, externen Nachrichten, produktiven Deployments oder riskanten Datenänderungen ohne Freigabe.

ZIEL: Nicht nach dem Grundgerüst stoppen. Alle Bestandteile verbinden und soweit möglich vollständig testen. Liefere lokal startbare Plattform, Installationsanleitung, Testergebnisse und Launch-Checkliste. Produktionsreife nur nach echten Integrations-, Sicherheits-, Betriebs- und Rechtsprüfungen behaupten; sonst Blocker sichern.

Speichere alle Anforderungen vollständig in LYNO_SPEC.md und erstelle daraus einen strukturierten Entwicklungsplan in PLAN.md. Bewahre sämtliche Features, Designvorgaben, Module und Preisstrategien.

## Fortgeltende Anforderungen aus dem Erstauftrag

- Professionelle, lokal ausführbare Gesamtanwendung für deutsche IT-Dienstleister und Agenturen mit 10–50 Mitarbeitern; keine bloße Demo, kein oberflächliches MVP, keine Sammlung funktionsloser Mockups.
- Repository zuerst untersuchen; vorhandenen Code erhalten. Bei leerem Repository moderne wartbare Architektur mit Next.js, TypeScript, Tailwind und PostgreSQL sowie sinnvolle Bibliotheken. Spezifikation, Plan und Arbeitsregeln vor Implementierung, überprüfbare Meilensteine; danach unmittelbar implementieren und bis zum Ziel fortsetzen.
- CORE zusätzlich Registrierung, Login, Passwort-Reset, strenge Mandantentrennung, Mitarbeiter-Einladungen, Audit-Logs, Datenexport und bestätigte Kontolöschung.
- FLOW zusätzlich Status, Prioritäten, Kommentare, Verlauf, Suche und funktionierende Vorlagen für Kunden-Onboarding, Qualitätsprüfungen und interne Freigaben.
- ACADEMY zusätzlich Artikel-Editor, Berechtigungen, Einarbeitungschecklisten und Verknüpfung mit Flow.
- ASSIST zusätzlich sichere API-Integration, Nutzungsgrenzen, Fehlerbehandlung und ausdrücklich gekennzeichneter Testmodus ohne Zugangsdaten. Überprüfbare Workflow-Entwürfe; keine unbemerkten Änderungen.
- INSIGHTS zusätzlich Prozessauswertungen, Bearbeitungszeiten, aussagekräftige Visualisierungen; keine erfundenen Echtdaten.
- Website zusätzlich Hero, Produktdarstellung, Modulübersicht, Vorteile, Kontakt, klare Handlungsaufforderungen, SEO, Performance und mobile Nutzung.
- Vertrieb zusätzlich Beta-Warteliste mit bestätigter Anmeldung und gesonderter Marketing-Einwilligung, eigenständig nutzbare Registrierung, Testphase; konfigurierbare Preise. Rechtstexte und Unternehmensangaben nicht erfinden.
- Design zusätzlich ausgezeichnete Typografie, konsistente Palette, dezente Animationen, funktionale Icons, sorgfältig gestaltete sämtliche Seiten, zugängliche Bedienung; jeder sichtbare Button funktioniert. Neuere Vorgabe verbietet dekorative KI-Icons und bunte Symbolreihen.
- Sicherheit zusätzlich sichere Sessions, geschützte Geheimnisse, serverseitige Eingabevalidierung, datensparsame Verarbeitung, robuste Fehlerbehandlung; keine fremden Firmendaten offenlegen. Tests für erlaubte und verbotene Zugriffe.
- Qualität zusätzlich echte Backend-Logik, Datenbanktabellen, Migrationen, APIs, gekennzeichnete Seed-Daten; Registrierung, Firmenisolierung, Abläufe, Berechtigungen und Abrechnung prüfen. Build, Typecheck und Tests ausführen und Fehler beheben.
- Nach jedem Schritt Plan und Teststatus aktualisieren; selbstständig nächste sinnvolle Aufgabe, unkritische Entscheidungen eigenständig, keine unnötigen Rückfragen oder doppelte Arbeit.
- Keine kostenpflichtigen Dienste, echten Zahlungen, Massennachrichten, produktiven Deployments oder Löschungen ursprünglicher Daten ohne Freigabe.
- Technisch fertig erst melden, wenn Website und App lokal funktionieren, Kernfunktionen implementiert und geprüft, Tests erfolgreich und Installation, Architektur, Deployment-Vorbereitung dokumentiert sind. Fehlende externe Zugänge, ungeprüfte Integrationen und Probleme ehrlich auflisten. Keine produktive oder rechtliche Freigabe behaupten. Bei echten Blockern Stand sichern und exakt benötigte Voraussetzungen nennen.

## Verbindliche Abnahme der Erweiterung

| ID  | Gegenstand              | Überprüfbare Abnahme                                                                                                                                                                                   |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E01 | Bestand und Gestaltung  | Bestehende Services weiterverwendet; Design-Review dokumentiert; Referenzbilder berücksichtigt sobald bereitgestellt; keine dekorativen KI-Symbole/Verläufe; drei Bildschirmgrößen, beide Farbschemata |
| E02 | Zentrales Produktmodell | CORE enthalten; drei Stufen; Zusatzmodule und Bundles; Preise, Limits und Features aus einer Konfiguration, identische Anzeige und serverseitige Prüfung                                               |
| E03 | Abrechnung              | Lokaler expliziter Zahlungstest; Stripe ausschließlich Test; bestätigte Zahlung aktiviert Module; signierte/replay-sichere Webhooks, Tarifwechsel, Endkündigung, Self-Service                          |
| E04 | Startrabatt             | Datenbankgestützte Kapazität 20 standardmäßig; konfigurierte Regeln, persistente Reservierungen, Ablauf und Einlösung; parallele Käufe überbuchen nicht; Erstkundenprüfung                             |
| E05 | Firmenanpassung         | Branding und Modulkonfiguration gespeichert; erneuter Login behält Änderungen; zweite Firma sieht/ändert diese nicht; frei konfigurierbare Rollen innerhalb der Rechte des Erstellers                  |
| E06 | Wissen und Lernen       | Zugriffsgeprüfte Dokumente, Artikel und geordnete Lernpfade mit persönlichem Fortschritt; erlaubte Quellen für Assist                                                                                  |
| E07 | Navigation und Berichte | Berechtigungsgefilterte globale Suche, gespeicherte Ansichten, reale exportierbare Auswertungen, konfigurierbare Benachrichtigungen                                                                    |
| E08 | Website und Kaufwege    | Alle fünf Modulseiten, Anwendungsfälle, interaktive Produktvorschau, Paketvergleich, zentrale Preise und echter Rabattzähler; Registrierung übernimmt Auswahl                                          |
| E09 | Qualität und Betrieb    | Unit-, PostgreSQL-Integrations-, Sicherheits- und E2E-Prüfung; Typecheck, Build; Desktop/Tablet/Mobil; dokumentierte Limits, Installation und Launch-Checkliste                                        |

### Entscheidungen und externe Voraussetzungen

Bestehende Preise Starter 149 EUR und Business 299 EUR bleiben als Ausgangskonfiguration erhalten, keine verbindliche Preiszusage. Premium und Zusatzmodule werden zentral als konfigurierbare Testangebote ergänzt. Rabattkapazität standardmäßig 20; Prozentsatz und Laufzeit werden explizit angezeigt und administrierbar gehalten. Abrechnung bleibt Testmodus, lokale Testzahlungen sind keine real zahlenden Kunden. Die anfangs fehlenden Referenzbilder sind inzwischen vorhanden und berücksichtigt; der nachfolgende Referenzabschnitt dokumentiert den Eingang. Externe Stripe-, KI- und SMTP-Prüfung sowie rechtliche/betriebliche Freigabe benötigen spätere echte Zugangsdaten bzw. Betreiberentscheidungen.

## Nachgereichte Designreferenzen

Am 11.10.2026 hat der Nutzer `Lyno_Designreferenzen.zip` mit sechs PNG-Referenzen für Landingpage, Dashboard, Flow, Academy, Assist und Insights bereitgestellt. Alle sechs wurden geprüft und unverändert in design-references gesichert. Gestaltungsentscheidungen und Abgleich: docs/DESIGN.md. Frühere Hinweise auf fehlende Bilder sind damit erledigt. Die schriftlichen Verbote für dekorative KI-Icons, bunte Symbolreihen, starke Verläufe und erfundene Kennzahlen bleiben verbindlich.

## Zwischenstand für Windows und GitHub – vollständiger Zusatzauftrag

> Ich möchte den aktuellen Entwicklungsstand von Lyno auf meinem Windows-PC über localhost testen, während du in der Cloud weiterarbeitest.
>
> Sichere den bisherigen Entwicklungsstand als Git-Commit und stelle ihn über einen Branch auf meinem verbundenen GitHub-Repository bereit.
>
> Nenne mir anschließend:
>
> - Den GitHub-Repository-Link
> - Den Branch mit dem neuesten Entwicklungsstand
> - Die genauen Installations- und Startbefehle für Windows
> - Welche Datenbank und Umgebungsvariablen lokal benötigt werden
>
> Unterbrich die weitere Entwicklung nicht dauerhaft. Veröffentliche Lyno nicht produktiv.

Abnahme: Quellcode-Commit und Remote-Branch nachgewiesen, keine Geheimnisse oder Cloud-Laufzeitdaten im Repository; PowerShell-Anleitung mit unabhängiger lokaler PostgreSQL-Datenbank. Die Übergabe ist ein Entwicklungsstand, keine Launch-Freigabe. Weitere Meilensteine bleiben erhalten.

## Fortgesetzter Zielauftrag

LYNO anhand sämtlicher bisheriger Anforderungen zu einer außergewöhnlich hochwertigen, funktionsfähigen B2B-SaaS-Plattform weiterentwickeln. Die ZIP mit sechs Designreferenzen ist zugänglich; Bilder liegen nun am ausdrücklich gewünschten Projektpfad `design-references/` und dienen Landingpage, Dashboard, Flow, Academy, Assist und Insights. Geeigneten Open-Design-Skill verwenden; Sicherheitsreview und lokale Installation sind dokumentiert. Funktionierenden Code bewahren.

Verbindlich bleiben Premium-Landingpage, Produktseiten, Preise/Paketvergleich, interaktive Demo, Registrierung/Kaufprozess; fünf echte Fachmodule mit gemeinsamer Datenbank, Firmen und sicheren Berechtigungen; umfangreiche Firmenanpassungen für Logos, Farben, Dashboards, Formulare, Workflows, Ansichten und Module; einzelne Module und Starter/Business/Premium mit serverseitigen Premium-Rechten; zentrale Abos, automatische bestätigte Freischaltung, Upgrades, Kündigung und Stripe-Testintegration; exklusiver, transaktionssicherer Startrabatt für die ersten 20 zahlenden Kunden; zusätzliche nützliche Arbeitserleichterungen.

Designziel: eigenständige Premium-Marke, orientiert an Linear und Stripe, minimalistisch, elegant und sorgfältig. Keine generischen KI-Designs, bunten Icon-Reihen, übertriebenen Verläufe oder überladenen Oberflächen. Selbstständig überprüfbare Meilensteine umsetzen, echte Funktionen bauen, Module/Rechte/Nutzerwege/Oberflächen automatisiert und im Browser prüfen, Fehler und Benutzerfreundlichkeit eigenständig verbessern und PLAN.md fortschreiben.

Nicht nach einem Grundgerüst enden: alle ohne externe Freigaben umsetzbaren Anforderungen implementieren und prüfen. Keine Ausgaben, echten Zahlungen oder produktiven Veröffentlichungen ohne Zustimmung. Abschluss mit lokal testbarer Plattform, Testergebnissen, Installationsanleitung und verbleibenden Launch-Voraussetzungen. Keine Marktreife behaupten, solange Sicherheits-, Betriebs-, Integrations- oder Rechtsprüfungen offen sind. Ein fehlender ZIP-Zugriff wäre ausdrücklich zu melden; hier liegt dieser Blocker nicht vor.
