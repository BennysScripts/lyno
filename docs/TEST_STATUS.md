# Prüfprotokoll

Stand: 11. Oktober 2026. Lokale Umgebung: Node.js 24.19, Next.js 16.4, PostgreSQL 17, Chromium.

| Prüfung                                                  | Ergebnis                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| TypeScript strict inkl. ungenutzter Bezeichner           | Erfolgreich                                                                                                     |
| SQL-Migrationen, erneute Anwendung                       | Erfolgreich, keine doppelte Migration                                                                           |
| Vitest Unit-/PostgreSQL-/Adaptertests                    | **50/50 erfolgreich**, einschließlich Pakete, Customization, Rabattkonkurrenz, Stripe-Adapter und Backup-Schutz |
| Playwright Desktop, Tablet und Smartphone                | **24/24 erfolgreich**, finaler Standalone-Lauf nach Referenzabgleich und Kontrastkorrektur, 1,3 Minuten         |
| axe WCAG 2 A/AA: Website, Dashboard Light/Dark, Insights | Keine automatisiert erkannten Verstöße in den geprüften Ansichten                                               |
| Next.js Produktionsbuild und Standalone-Paket            | Erfolgreich; `.env`- und Postfach-Ausschluss im finalen Paket geprüft                                           |
| npm audit, Produktions- und Entwicklungsabhängigkeiten   | **0 bekannte Schwachstellen** zum Prüfzeitpunkt                                                                 |
| Formatierung und git diff --check                        | Erfolgreich                                                                                                     |

## Fachliche und Sicherheitsprüfungen

- Registrierung mit Firma/Testphase, gehashte Passwörter und Sessions, Login/Logout.
- SQL Row Level Security mit nicht privilegierter Anwendungsrolle und ohne expliziten Query-Tenantfilter.
- Fremde Firmen-IDs bei Lesen, Schreiben und Firmenwechsel; zusammengesetzte Fremdschlüssel.
- Verbotene Rolleneskalation und Erhalt des letzten Inhabers.
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
- Browser: alle Modulseiten, Paketübernahme in Registrierung, Branding/Homepage/Widgets, Logo, Rollen, gespeicherte Ansichten, Suche, Dokumentupload, Lernpfad und CSV-Bericht auf drei Bildschirmgrößen.

## Sichtprüfung

Desktop: 1440 × 1000. Tablet: 834 × 1194. Smartphone: 390 × 844, Touch/Chromium-Emulation. Sechs Nutzerreferenzen sind in docs/design-references gesichert und im Design dokumentiert. Website, Dashboard und Dark Mode wurden per Screenshot angesehen. Ein mobiler Grid-Überlauf und Kontrastfehler wurden korrigiert; die Tests prüfen auch die Dashboardbreite. Im letzten Lauf verursachte ein älterer beiger Avatarhintergrund ein Kontrastverhältnis von 4,48 statt mindestens 4,5. Der Hintergrund verwendet jetzt das gültige Oberflächen-Token; anschließend bestanden alle 24 Fälle. Scrollbare Tabellen sind per Tastatur fokussierbar. Browsertests verwenden reduzierte Bewegung, damit Übergangsanimationen keine instabilen Kontrastmessungen verursachen.

Screenshots: `docs/screenshots/`. Die abschließenden Browsertests verwenden den tatsächlich gebauten Standalone-Webdienst, keinen Backend-Mock.

## Grenzen der Aussage

Automatisierte Zugänglichkeitsprüfungen ersetzen keinen Test mit assistiven Technologien. Keine Abnahme auf echtem Windows, Safari/iOS. Kein Last- oder Penetrationstest; Backup-Restore lokal nachgewiesen, externer Speicher und RPO/RTO ungeprüft. Die vorbereitete GitHub-CI wurde hier noch nicht remote ausgeführt. OpenAI, SMTP-Zustellbarkeit und Stripe-Checkout wurden ohne Zugangsdaten **nicht gegen externe Anbieter geprüft**. Providererfolg mit anschließendem DB-Ausfall und verlorene Ablaufwebhooks benötigen weitere Wiederanlauf-/Abgleichsprüfung. Keine externen E-Mails, echten Zahlungen, kostenpflichtigen KI-Aufrufe oder produktiven Deployments durchgeführt. Details und benötigte Angaben: `docs/LAUNCH.md`.

## Fortsetzung nach dem GitHub-Zwischenstand

Commit 03f0b7e wurde von GitHub in ein unabhängiges Verzeichnis geklont. `npm ci`, alle acht Migrationen gegen eine neue PostgreSQL-17-Instanz, Seed, Typecheck, 47 Backendtests, Build, Standalone-Start, Browser-Anmeldung und autorisierter API-Zugriff erfolgreich. Dies prüft fehlende versionierte Dateien und Installationsabhängigkeiten; es ist weiterhin ein Linux-Test, keine Windows-Ausführung.

Danach lokale `db:backup`-/`db:restore`-Werkzeuge ergänzt: binärer Datenstrom statt Shell-Ausgabeumleitung, exklusive Dateierstellung, SHA-256-Prüfung, Restore ausschließlich in neue Datenbanken mit kontrolliertem Namen. Tatsächlicher Dump und Restore gegen PostgreSQL erfolgreich. Inhalt/Fingerprints aller 35 Tabellen und Einstellungen aller 21 RLS-Tabellen stimmen überein. Anwendung ohne Tenant-Kontext sieht keine Aufgaben; mit gültigem Tenant-Kontext ist der Zugriff weiterhin möglich. Überschreiben vorhandener Datei/Datenbank, Restore in die Anwendungsdatenbank und beschädigte Sicherung abgewiesen. Drei zusätzliche automatisierte Schutztests erhöhen den Gesamtumfang auf 50. Dumps und Laufzeitdaten bleiben außerhalb von Git.

Die Vitest-Pfadauflösung nutzt `fileURLToPath` statt URL-Pfadnamen, damit Windows-Laufwerksbuchstaben korrekt behandelt werden. Die manuelle Browserprüfung verwendet auf Windows den installierten Playwright-Browser. Der Frontend-Code wurde seit dem erfolgreichen Lauf der 24 Browserfälle nicht geändert.
