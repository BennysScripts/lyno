# Prüfprotokoll

Stand: 11. Oktober 2026. Lokale Umgebung: Node.js 24.19, Next.js 16.4, PostgreSQL 17, Chromium.

| Prüfung                                                            | Ergebnis                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| TypeScript strict inkl. ungenutzter Bezeichner                     | Erfolgreich                                                                                                   |
| SQL-Migrationen, erneute Anwendung                                 | Erfolgreich, keine doppelte Migration                                                                         |
| Vitest Unit-/PostgreSQL-/Adaptertests                              | **58/58 erfolgreich**, einschließlich Rechte, Teamkonflikte, Lernpfade, Stripe-Wiederanlauf und Backup-Schutz |
| Playwright Desktop, Tablet und Smartphone                          | **27/27 erfolgreich**, finaler Standalone-Lauf auf drei Bildschirmgrößen, 1,8 Minuten                         |
| axe WCAG 2 A/AA: Website, Dashboard und alle Fachmodule Light/Dark | Keine automatisiert erkannten Verstöße in den geprüften Ansichten auf Desktop/Tablet/Smartphone               |
| Next.js Produktionsbuild und Standalone-Paket                      | Erfolgreich; `.env`- und Postfach-Ausschluss im finalen Paket geprüft                                         |
| Tatsächlicher PostgreSQL-Backup/Restore                            | 36 Tabellen/Fingerprints und 22 RLS-Tabellen identisch; erlaubte/verbotene Zugriffe geprüft                   |
| npm audit, Produktions- und Entwicklungsabhängigkeiten             | **0 bekannte Schwachstellen** zum Prüfzeitpunkt                                                               |
| Formatierung und git diff --check                                  | Erfolgreich                                                                                                   |

## Fachliche und Sicherheitsprüfungen

- Registrierung mit Firma/Testphase, gehashte Passwörter und Sessions, Login/Logout.
- SQL Row Level Security mit nicht privilegierter Anwendungsrolle und ohne expliziten Query-Tenantfilter.
- Fremde Firmen-IDs bei Lesen, Schreiben und Firmenwechsel; zusammengesetzte Fremdschlüssel.
- Verbotene Rolleneskalation und Erhalt des letzten Inhabers.
- Teams per stabiler ID umbenennen; gleichnamige Neuanlage ergibt Konflikt und lässt Mitglieder unverändert. Fremde Team-ID und Mitgliederrolle abgewiesen; geschütztes Teamwissen bleibt beim Umbenennen zugänglich.
- Einladung an verifizierte Empfängeradresse, Annahme nur einmal; gesetztes Mitgliederrecht anschließend serverseitig wirksam.
- Pflichtfelder, Typvalidierung, Bedingungen, Reihenfolge, Freigaberechte und konkurrierende Aufgabenabschlüsse.
- Serverseitige Workflow-Suche und Pagination ohne Duplikate oder verlorene Treffer.
- Zuweisungen bei Rollenentzug; Paket-Platzlimit; Schreibschutz nach Testphasenende; Kündigung zum Laufzeitende.
- Artikelrechte für Unternehmen/Team/Management auch in Assist; prüfbare Quellen und Entwürfe ohne automatische Ausführung; Tageslimit.
- Wiederkehrende Abläufe und Erinnerungen: idempotente Verarbeitung; Tests beschränken Jobs auf ihre eigenen Firmen.
- Double-Opt-in getrennt von optionaler Marketing-Einwilligung, Bestätigungslink nur einmal.
- Lokales Testabo, Kündigung/Wiederaufnahme, ausschließlich Testevents; Live-Schlüssel werden abgewiesen.
- Stripe-Vertragstests mit echten lokal erzeugten Testsignaturen: falsche Signatur, Live-Event und doppelte Event-ID. Kein externer Stripe-Aufruf.
- Passwortreset einmalig, Widerruf bestehender Sessions.
- Kontolöschung/Firmenlöschung mit Passwort, Rolle und exakter Bestätigung; gesondertes Opt-in zur vollständigen Identitätslöschung.
- SMTP-Outbox: AES-256-GCM-Verschlüsselung, obligatorische TLS-Konfiguration, erfolgreiche Zustellung und Inhaltsentfernung, Backoff und Abbruch nach fünf Fehlern. Transport ausschließlich gemockt.
- Browser: kompletter Ablauf von Registrierung und Verifizierung bis Flow, Artikel, Assist, Export und Testabo; Vorlageneditor mit Bedingung; Team-Einladung und verbotene Mitgliederaktionen; Firmenlöschung und erneutes Onboarding.
- CORE/Einzelmodule/Bundles und Starter/Business/Premium: zentrale Berechnung, Modulrechte, Nutzer-/Automations-/KI-Limits und ungebuchte Moduldaten im App-State.
- Testbestellung ohne voreilige Freischaltung, explizite Bestätigung, Ablauf, fremde Bestell-ID, wiederholte Bestätigung und Paketwechsel.
- Konkurrenz um die letzten Rabattplätze, Käuferhistorie und wiederholte Einlösung; Kampagnenänderung für Anwendungsrolle verboten.
- Stripe-Adapter mit gemockten API-Antworten und echter SDK-Signaturprüfung: verzögerter Checkout, falsche Zuordnung/Signatur/Live-Event, bezahlte Upgrade-Rechnung, Zahlungsfehler/Wiederaufnahme, veraltete Events, Portal und Storno. Keine echten Provideraufrufe.
- Firmen-/Personenoptionen, eingeschränkte Zusatzrollen, fremde Rollen-ID, unzulässige Rechteeskalation, Logoformat- und Bilddatenprüfung.
- Dokumenttypen, Mandanten-/Team-/Managementsichtbarkeit, globale Suche und geordnete Lernfortschritte einschließlich Rücknahme und nicht sichtbarer Artikel.
- Stripe-Wiederanlauf nach simulierter DB-Störung direkt nach Providerantwort; fester Auftrag/Preis/Rabatt bleibt erhalten, identische Idempotenzparameter bei Wiederholung, keine frühe Freischaltung. Konkurrierende Worker, abgelaufener Lease, verlorene Zahlungs-/Ablaufwebhooks, verspätete alte Checkout-Meldung und Ende des 22-Stunden-Fensters geprüft.
- Firmenlöschung mit aktivem Stripe-Testabo, offener Bestellung oder ungeklärtem Providerauftrag blockiert.
- Persönliche Academy-Checklisten für Mitglieder mit Leserecht funktionieren nach Neuladen und verändern den Fortschritt anderer Personen nicht.
- Lernpfadbearbeitung erhält Fortschritt bei Textänderungen; Schrittänderungen benötigen ausdrückliche Bestätigung und setzen nur ab dem ersten veränderten Schritt zurück.
- Browser: alle Modulseiten, Paketübernahme in Registrierung, Branding/Homepage/Widgets, Logo, Rollen, gespeicherte Ansichten, Suche, Dokumentupload, Lernpfad und CSV-Bericht auf drei Bildschirmgrößen.

## Sichtprüfung

Desktop: 1440 × 1000. Tablet: 834 × 1194. Smartphone: 390 × 844, Touch/Chromium-Emulation. Sechs Nutzerreferenzen sind in design-references gesichert und im Design dokumentiert. Website, Dashboard und Fachmodule wurden in Light/Dark anhand der Desktop- und Mobil-Screenshots angesehen. Diagramme verwenden die gemeinsamen Designfarben sowie eine Legende und unterschiedliche Linienmuster. Ein mobiler Grid-Überlauf und Kontrastfehler wurden korrigiert; die Tests prüfen auch die Dashboardbreite. Ein früherer Lauf fand einen älteren beigen Avatarhintergrund mit einem Kontrastverhältnis von 4,48 statt mindestens 4,5. Der Hintergrund verwendet jetzt das gültige Oberflächen-Token; anschließend bestanden die damaligen 24 Fälle. Der nun erweiterte finale Lauf besteht alle 27 Fälle einschließlich Teamumbenennung, Namenskonflikten, Lernpfadbearbeitung und persönlicher Checkliste. Scrollbare Tabellen sind per Tastatur fokussierbar. Browsertests verwenden reduzierte Bewegung, damit Übergangsanimationen keine instabilen Kontrastmessungen verursachen.

Screenshots: `docs/screenshots/`. Die abschließenden Browsertests verwenden den tatsächlich gebauten Standalone-Webdienst, keinen Backend-Mock.

## Grenzen der Aussage

Automatisierte Zugänglichkeitsprüfungen ersetzen keinen Test mit assistiven Technologien. Keine Abnahme auf echtem Windows, Safari/iOS. Kein Last- oder Penetrationstest; Backup-Restore lokal nachgewiesen, externer Speicher und RPO/RTO ungeprüft. Das Ergebnis der vorbereiteten GitHub-CI wurde hier nicht remote verifiziert. OpenAI, SMTP-Zustellbarkeit und Stripe-Checkout wurden ohne Zugangsdaten **nicht gegen externe Anbieter geprüft**. Providererfolg mit anschließendem DB-Ausfall und verlorene Ablaufwebhooks sind lokal mit gemocktem SDK geprüft; der reale Providerwiederanlauf sowie das operative Vorgehen außerhalb des Wiederholungsfensters bleiben extern abzunehmen. Keine externen E-Mails, echten Zahlungen, kostenpflichtigen KI-Aufrufe oder produktiven Deployments durchgeführt. Details und benötigte Angaben: `docs/LAUNCH.md`.

## Fortsetzung nach dem GitHub-Zwischenstand

Commit 03f0b7e wurde von GitHub in ein unabhängiges Verzeichnis geklont. `npm ci`, alle acht Migrationen gegen eine neue PostgreSQL-17-Instanz, Seed, Typecheck, 47 Backendtests, Build, Standalone-Start, Browser-Anmeldung und autorisierter API-Zugriff erfolgreich. Dies prüft fehlende versionierte Dateien und Installationsabhängigkeiten; es ist weiterhin ein Linux-Test, keine Windows-Ausführung.

Danach lokale `db:backup`-/`db:restore`-Werkzeuge ergänzt: binärer Datenstrom statt Shell-Ausgabeumleitung, exklusive Dateierstellung, SHA-256-Prüfung, Restore ausschließlich in neue Datenbanken mit kontrolliertem Namen. Tatsächlicher Dump und Restore gegen PostgreSQL erfolgreich. Inhalt/Fingerprints aller 35 Tabellen und Einstellungen aller 21 RLS-Tabellen stimmen überein. Anwendung ohne Tenant-Kontext sieht keine Aufgaben; mit gültigem Tenant-Kontext ist der Zugriff weiterhin möglich. Überschreiben vorhandener Datei/Datenbank, Restore in die Anwendungsdatenbank und beschädigte Sicherung abgewiesen. Drei zusätzliche automatisierte Schutztests erhöhen den Gesamtumfang auf 50. Dumps und Laufzeitdaten bleiben außerhalb von Git.

Die Vitest-Pfadauflösung nutzt `fileURLToPath` statt URL-Pfadnamen, damit Windows-Laufwerksbuchstaben korrekt behandelt werden. Die manuelle Browserprüfung verwendet auf Windows den installierten Playwright-Browser. Seitdem wurden Lernpfad-, Checklisten-, Abrechnungs- und Teamoberflächen erweitert und im neuen Lauf mit 27 Fällen erneut geprüft.

## Abschließende Fortsetzung einschließlich Migration 009

Typecheck, 58 Backendtests, Build und 27 Browserfälle vollständig bestanden. Alle neun Migrationen wurden in beiden neu erzeugten Testdatenbanken angewendet; die erneute Migration der Arbeitsdatenbank ist ebenfalls erfolgreich. npm audit meldet für Produktions- und Entwicklungsabhängigkeiten null bekannte Schwachstellen. Das gebaute Standalone-Paket enthält keine `.env` oder lokalen Postfachkopien.

Die erste erweiterte Browserprüfung fand eine kontrollierte Checkbox, die vor dem Server-Rücklauf kurz zurücksprang. Der Zustand wird jetzt bis zur Antwort angezeigt, bei Fehlern zurückgenommen und gegen doppelte Bedienung gesperrt. Wiederholte frühere E2E-Läufe beanspruchten außerdem dieselben Anmeldelimits und Rabattplätze der Entwicklungsdatenbank. Behoben durch eigene temporäre PostgreSQL-Datenbanken und Laufzeitverzeichnisse je Testlauf; Schutzregeln wurden nicht abgeschwächt, Arbeitsdaten nicht zurückgesetzt. Zwei vollständige isolierte Läufe erfolgreich, der letzte enthält zusätzlich die sichere Teamumbenennung.

Ein aktueller Dump nach Migration 009 wurde in `lyno_restore_009_20261011` wiederhergestellt. Fingerprints/Inhalte aller **36 Tabellen**, RLS-Einstellungen aller **22 geschützten Tabellen** und sämtliche Policies sind identisch. Kein Aufgabenlesezugriff ohne Tenant-Kontext; mit gültigem Tenant-Kontext exakt die erwarteten Aufgaben. Die ursprüngliche Datenbank bleibt unverändert. Dumps und Restore-Prüfskript liegen ausschließlich unter dem ignorierten `.local/`-Pfad. Frühere Schutzprüfungen gegen vorhandene Ziele/beschädigte Dumps bleiben in den automatisierten Tests enthalten.
