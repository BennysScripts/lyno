# Installation und Betriebsvorbereitung

## Konfiguration

`.env.example` beschreibt die benötigten Werte. Die enthaltenen Datenbankpasswörter sind ausschließlich lokale Entwicklungswerte. Vor Betrieb individuelle starke Passwörter setzen. `DATABASE_URL` muss als `lyno_app` verbinden. `MIGRATION_DATABASE_URL` und `DB_APP_PASSWORD` gehören nur in den Migrationsjob, nicht in den Webdienst.

| Variable                                                                   | Zweck                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| APP_URL                                                                    | Exakter öffentlicher Ursprung; Basis für Links, Origin-Schutz und Secure-Cookie |
| DATABASE_URL                                                               | Eingeschränkte Anwendungskonnektion                                             |
| MIGRATION_DATABASE_URL                                                     | Administrative Verbindung nur für Migrationen/Tests                             |
| DB_APP_PASSWORD                                                            | Passwort der eingeschränkten Rolle, beim Migrieren gesetzt                      |
| MAIL_MODE                                                                  | `local` (Standard) oder ausdrücklich konfiguriertes `smtp`                      |
| ASSIST_MODE                                                                | `test` (Standard) oder ausdrücklich `openai`                                    |
| OPENAI_API_KEY / OPENAI_MODEL                                              | Optionaler, serverseitiger KI-Zugang und Modell                                 |
| PRICE_STARTER_EUR / PRICE_BUSINESS_EUR / PRICE_PREMIUM_EUR                 | Vollständige Modulbundles, monatlich netto in EUR                               |
| PRICE_CORE_STARTER_EUR / PRICE_CORE_BUSINESS_EUR / PRICE_CORE_PREMIUM_EUR  | CORE-Basispreise                                                                |
| PRICE_FLOW_EUR / PRICE_ACADEMY_EUR / PRICE_ASSIST_EUR / PRICE_INSIGHTS_EUR | Einzelne Zusatzmodule, monatlich netto                                          |
| STRIPE_SECRET_KEY                                                          | Optional nur `sk_test_…`; Live-Schlüssel werden abgewiesen                      |
| STRIPE_WEBHOOK_SECRET                                                      | Signaturprüfung für `/api/billing/webhook`                                      |
| LEGAL_COMPANY / LEGAL_ADDRESS / LEGAL_EMAIL                                | Nur verifizierte Betreiberangaben, kein Ersatz für rechtliche Prüfung           |

Echte Kosten oder Zahlungen wurden nicht ausgelöst. Das Aktivieren eines KI-Anbieters kann Kosten verursachen und erfordert vor Verwendung die Freigabe des Betreibers sowie rechtliche Bewertung der Datenübertragung.

`LYNO_DATA_DIR` legt optional das absolute Laufzeitdatenverzeichnis fest; im lokalen Betrieb ist es `.local`. `LYNO_BIND_HOST` bestimmt die Bind-Adresse von `npm start` und ist standardmäßig `127.0.0.1`. Für HTTP-Prüfungen eines Produktionsbuilds ist `ALLOW_INSECURE_LOCALHOST=true` nur auf Loopback erlaubt. Andere Produktions-URLs benötigen HTTPS.

Der Build bereinigt das erzeugte Standalone-Paket von `.env`-Dateien und lokalen Nachrichten. Dies kompensiert das automatische Kopieren von Umgebungsdateien durch Next.js. Laufzeitgeheimnisse werden beim Start injiziert und dürfen nicht mit einem Release-Artefakt geteilt werden.

## Datenbank und Migrationen

`npm run db:migrate` hält eine PostgreSQL-Advisory-Lock und führt noch nicht angewendete SQL-Dateien in Reihenfolge und jeweils in einer Transaktion aus. `schema_migrations` speichert den Status. Vor neuen Migrationen ein Backup erstellen. Die Anwendung hat keinen Zugriff auf die Migrationstabelle und kann bestehende Audit-Einträge nicht direkt ändern oder löschen. Elternlöschungen gemäß Kontolöschfunktion entfernen zugehörige Daten über Foreign-Key-Cascades.

`docker compose stop` beendet die Datenbank ohne Datenverlust. **`docker compose down -v` würde Daten löschen und ist nicht Bestandteil der Installations- oder Wartungsanleitung.**

## Webdienst und Worker

1. Abhängigkeiten mit `npm ci` installieren.
2. Migration als separaten Freigabeschritt ausführen.
3. `npm run build`, dann `npm start` hinter TLS-Reverse-Proxy.
4. `npm run jobs` regelmäßig über systemd timer oder vergleichbaren Scheduler aufrufen. Nur eine Mandantenverarbeitung läuft gleichzeitig; mehrere Worker dürfen gestartet werden.
5. `/api/health` prüft Webdienst und DB-Verbindung. Kein Geheimnis wird zurückgegeben.

Eine beispielhafte systemd-Unit liegt unter `ops/`. Pfade und Benutzer anpassen; sie wurde nicht auf einem produktiven Host installiert. Der Webdienst sollte nur auf dem intern vorgesehenen Interface erreichbar sein. Datenbankport ausschließlich lokal/private Netze, TLS extern obligatorisch. Der Reverse-Proxy sollte zusätzlich Verbindungs-, Requestgrößen- und IP-basierte Limits erzwingen. Die Anwendung vertraut keiner frei eingesendeten X-Forwarded-For-Adresse.

## Optionaler SMTP-Versand

Standard ist `MAIL_MODE=local`. Für SMTP sind `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT` (465 oder 587), `SMTP_USER`, `SMTP_PASSWORD`, eine verifizierte `MAIL_FROM`-Adresse und `MAIL_ENCRYPTION_KEY` erforderlich. Der Schlüssel besteht aus 32 zufälligen Bytes in Base64, etwa lokal mit `openssl rand -base64 32` erzeugt; er muss getrennt von Datenbank und Release-Artefakt gesichert werden.

Ausgehende Bestätigungen werden mit AES-256-GCM in `mail_outbox` gespeichert. Registrierung und Einladungen schreiben die Outbox in derselben DB-Transaktion. `npm run jobs` verarbeitet höchstens zehn fällige Nachrichten pro Aufruf. TLS ist obligatorisch, Zertifikatsprüfung bleibt aktiv. Fehler führen zu exponentiellem Backoff; nach fünf Versuchen ist der Status `failed`. Logs enthalten nur generische Fehlercodes. Nach erfolgreicher Zustellung wird der verschlüsselte Nachrichteninhalt entfernt. Ein stabiler Message-ID-Header unterstützt Nachvollziehbarkeit; nach einem Absturz zwischen Providerzustellung und DB-Commit kann eine Nachricht erneut zugestellt werden (At-least-once, keine Exactly-once-Zusage).

Vor Aktivierung benötigen Sie Betreiberfreigabe, Versanddomain und passende Rechtsgrundlage. Erst nach Konfiguration im SMTP-Modus erzeugte Nachrichten gelangen in die Versandwarteschlange; vorhandene lokale Testdateien werden niemals nachträglich versendet. Der integrierte Testtransport verwendet ausschließlich Mocks, keinen externen Empfänger. Fehlerhafte oder dauerhaft fehlgeschlagene Queueeinträge müssen vom Betreiber geprüft werden; es gibt keinen öffentlichen Outbox-Endpunkt. Verschlüsselte fehlgeschlagene Nachrichten und lokale Testdateien benötigen ein verbindliches Löschkonzept.

## Stripe-Testprüfung

Nur `STRIPE_SECRET_KEY=sk_test_…` und `STRIPE_WEBHOOK_SECRET` verwenden. Der Adapter erstellt Auswahl-spezifische monatliche Testpreise und gegebenenfalls einen Rabattcoupon aus dem zentralen Katalog; separate `STRIPE_PRICE_*`-Variablen sind nicht mehr nötig. Unterstützte Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Signatur und `livemode=false` werden geprüft; verarbeitete Ereignis-IDs sind eindeutig.

Eine gespeicherte Bestellung bindet Firma, Auswahl, Preis, Rabatt, Checkout und gegebenenfalls Rechnung zusammen. Zahlungsbelege werden gegen den tatsächlichen Stripe-Abostatus und die gespeicherte Price-ID geprüft. Ein Browser-Redirect aktiviert keine Rechte. Paketwechsel verwenden `pending_if_incomplete` und schalten erst nach bestätigter Zahlung frei. Das Portal erlaubt Zahlungsdaten, Rechnungen und Endkündigung; freie Paketänderungen dort sind deaktiviert, damit die geprüfte Bestelllogik gilt. Lokal erzeugt die explizite Testbestätigung einen Zahlungsbeleg ohne Provider-Aufruf; lokale Paketwechsel beginnen einen neuen Testmonat ohne anteilige Verrechnung.

Kein externer Testaccount war verfügbar; Webhooks und API-Aufrufe müssen vor Anbieterfreigabe gegen Stripe-Testressourcen geprüft werden. Fehlerhafte Webhooks erhalten einen Fehlerstatus, damit der Anbieter erneut zustellen kann. DB-/Netzwerkfehler nach einer externen Mutation werden innerhalb eines begrenzten Fensters über dauerhafte Aufträge und feste Idempotenzschlüssel wiederaufgenommen; außerhalb dieses Fensters ist operative Abstimmung nötig. Eine verteilte atomare Transaktion wird nicht behauptet.

### Dauerhafte Aufträge und Wiederanlauf

Seit Migration 009 werden Stripe-Checkout, Tarifwechsel, Kündigung/Wiederaufnahme und Bestellabbruch zuerst als RLS-geschützter Auftrag gespeichert. Auswahl, Preis, Rabattreservierung und Providerparameter sind committed, bevor ein externer Schreibaufruf erfolgt. Die API versucht danach sofort die Ausführung; `npm run jobs` nimmt offene Aufträge wieder auf. Fehlerantworten löschen den ursprünglichen Auftrag nicht. Das Firmeninhaber-Konto sieht den Status und kann eine Prüfung anstoßen.

Provider-Schreibaufrufe verwenden aus Auftrag/Bestellung abgeleitete feste Idempotenzschlüssel. Die gespeicherten Checkout-Parameter einschließlich Ablaufzeit bleiben bei Wiederholung gleich. Worker beanspruchen Aufträge mit einem zeitlich begrenzten Lease und serialisieren die Ausführung zusätzlich über die Firmenzeile. Fehler führen zu Backoff, nach acht Versuchen zu einer Inhaberbenachrichtigung. Spätestens 22 Stunden nach Auftragsanlage werden neue Schreibversuche beendet: Stripe garantiert keine unbegrenzte Aufbewahrung von Idempotenzschlüsseln. Danach ist ein kontrollierter Betreiberabgleich erforderlich; automatisches Neuanlegen wäre unsicher. Testcheckouts laufen spätestens 23 Stunden nach Vorbereitung ab.

Ein regelmäßiger kanonischer Providerabgleich prüft gespeicherte Sessions/Rechnungen und Abos. Er holt fehlende Zahlungsbestätigungen und Ablaufmeldungen nach, gibt Rabattplätze erst nach bestätigtem Ablauf frei und prüft Verlängerungsstatus. Ein aktives Providerabo allein reicht nicht zur nachträglichen Freischaltung; gespeicherte Price-ID und Zahlungsbeleg müssen passen. Wiederholte Polls und verspätete Webhooks erzeugen keine doppelten Rechte oder Zahlungsbelege. Firmen mit laufendem Stripe-Testabo, offener Stripe-Bestellung oder ungeklärtem Auftrag können nicht gelöscht werden, bevor diese Verpflichtungen geklärt sind.

Operatorprüfung offener Aufträge: `billing_operations.status`, `attempts`, `last_error_code`, `next_attempt_at`; je Firma `organizations.billing_checked_at` und `billing_check_error`. Fehlermeldungen speichern keine Providerantworten oder Geheimnisse. Der Betreiber benötigt Monitoring auf Status `attention` und fehlende/fehlgeschlagene Abgleiche. Ein Prozessausfall außerhalb des begrenzten Idempotenzfensters, eine manuelle Änderung im Stripe-Dashboard oder ein Accountwechsel benötigt weiterhin manuelle Prüfung. Keine externe Verbindung wurde für die implementierten Ausfalltests hergestellt.

## Katalog, Limits und Startrabatt

`src/lib/catalog.ts` definiert drei Pakete und die vier Zusatzmodule. CORE ist immer enthalten. Nutzerlimits 15/50/150, aktive Wiederholungen 3/25/100 und KI-Anfragen pro Tag 50/200/1000 werden im Backend geprüft. Firmen können das KI-Limit weiter absenken. Individuelle Zusatzrollen benötigen Business oder Premium. Während der 14-tägigen Testphase sind alle Module verfügbar. Eine offene Herabstufungsbestellung begrenzt neue Nutzer und Automationen bereits auf die niedrigere Kapazität, damit die spätere Bestätigung das Limit nicht überzieht.

Rabattregeln stehen in `launch_campaign`. Standard: erste 20 zahlende Neukunden, 20 Prozent für drei Monate. Administrativer lokaler Aufruf mit Migrationsrechten:

```bash
npm run campaign -- show
npm run campaign -- configure 20 20 3 true
```

Die Argumente sind Kapazität, Prozentsatz, Monate und Aktivierung. Die Kapazität darf belegte Plätze nicht unterschreiten. Die Anwendungsrolle kann die Regeln nicht ändern. Katalogpreise sind konfigurierbare Testangebote, keine kommerziell freigegebenen Konditionen.

Eine gemeinsame PostgreSQL-Sperre serialisiert Reservierung und Betreiberänderungen. Erstkunden werden anhand eines gehashten verifizierten Käufer-E-Mail-Schlüssels erkannt; ein Firmenwechsel oder eine erneute Firmengründung stellt keinen zweiten Platz bereit. Dies verhindert keine Mehrfachidentitäten mit anderen E-Mail-Adressen und ist keine rechtlich geprüfte Kundendefinition. Lokale Reservierungen verfallen nach 30 Minuten. Stripe-Reservierungen bleiben bis zur bestätigten Zahlung oder einem bestätigten Abbruch/Ablauf gebunden, damit verspätete Providerereignisse nicht überbuchen. Der implementierte regelmäßige Abgleich holt verlorene Ablaufwebhooks nach. Dafür muss der Worker tatsächlich laufen; dessen Überwachung und Prüfung gegen ein echtes Stripe-Testkonto sind vor Launch erforderlich. Zähler enthalten ausschließlich echte Datenbankwerte, im aktuellen Modus ausdrücklich Testkäufe.

Ein persistentes Käuferregister erhält die einmalige Rabatteinlösung auch nach Firmenlöschung. Es enthält einen pseudonymen E-Mail-Hash und Zeit-/Einlösungsdaten. Rechtsgrundlage, Auskunft, Löschfristen und Aufbewahrung dieses Registers müssen vor kommerziellem Betrieb festgelegt werden.

## Dateien und Individualisierung

Firmenlogos werden als validierte PNG/JPEG/WebP-Bilder bis 250 KB und 1024 Pixel Kantenlänge gespeichert. Dokumente sind auf PDF, UTF-8-Text und Markdown, jeweils 2 MB, beschränkt; Gesamtspeicher je Firma 10/25/50 MB. Downloads prüfen Firma und Wissenssichtbarkeit und verwenden Attachment-Header. Geeignete Textdateien erzeugen einen gleichberechtigt geschützten Wissensartikel; PDFs werden nicht automatisch ausgelesen. Vor offenem kommerziellem Dateiupload fehlen Malware-Scanning und eine separate Betriebsprüfung.

Moduleinstellungen, persönliche Ansichten, Lernfortschritt und Firmenrollen besitzen Tenant-Zuordnung und RLS. Individuelle Rollen können die Grundrolle einschränken, aber keine höheren Rechte erzeugen. Suchergebnisse und Assist-Quellen wenden dieselben Wissensrechte an.

## Backup, Wiederherstellung und Löschung

Regelmäßige verschlüsselte PostgreSQL-Backups mit definierter Aufbewahrung und Zugriffskontrolle planen. Beispiel nur nach Konfiguration einer sicheren Backup-Verbindung:

```bash
pg_dump --format=custom --file=lyno-backup.dump "$BACKUP_DATABASE_URL"
```

Wiederherstellung ausschließlich in eine neue, leere Prüfdatenbank testen. Kein automatisiertes Überschreiben vorhandener Instanzen. Mindestens ein vollständiger Restore-Test ist vor Launch erforderlich. Backup-Speicher gehört nicht ins Repository.

Für die lokale Compose-Installation stehen plattformunabhängige Streaming-Werkzeuge bereit:

```bash
npm run db:backup -- .local/backups/vor-update.dump
npm run db:restore -- .local/backups/vor-update.dump lyno_restore_pruefung_01
```

Das Backup erzeugt Datei und SHA-256-Metadaten exklusiv, ohne vorhandene Sicherungen zu überschreiben. Restore prüft den Hash und akzeptiert ausschließlich neue Namen mit Präfix `lyno_restore_`; `createdb` muss erfolgreich sein, bevor `pg_restore` in einer Transaktion läuft. Es gibt kein DROP und kein `--clean`. Bei Fehlern bleiben unvollständige Sicherungen bzw. neue Prüfdatenbanken zur Diagnose bestehen; die Anwendung wird nicht auf das Restore-Ziel umgeschaltet. Nur vertrauenswürdige eigene Dumps einspielen: PostgreSQL-Sicherungen enthalten ausführbare SQL-Definitionen, die Prüfsumme ist kein Herkunftsnachweis.

Die Werkzeuge setzen den lokalen Dienst `db`, Datenbank/Administrator `lyno` und die bereits eingerichtete Rolle `lyno_app` voraus. Optional wählt `LYNO_DB_CONTAINER` einen ausdrücklich benannten lokalen Docker-Container statt Compose. Es werden keine DB-Passwörter als Prozessargumente übergeben. Die Dateiströme erhalten Binärdaten auch unter PowerShell. Dumps und JSON-Metadaten gehören zusammen, sind nicht verschlüsselt und werden von Git ausgeschlossen; auf Unix gilt Modus 0600, unter Windows gelten zusätzlich die Verzeichnis-ACLs. Rollen, Runtime-Geheimnisse und lokales Postfach müssen gesondert gesichert werden.

Nach der GitHub-Übergabe wurde ein frischer Checkout in einer unabhängigen PostgreSQL-17-Instanz migriert, gesät, gebaut und mit 47 Backend-Prüfungen getestet. Ein anschließend erzeugter Dump wurde in eine neue Prüfdatenbank wiederhergestellt: Inhalt und Anzahl aller 35 Tabellen identisch; 21 RLS-Tabellen und erlaubte/verbotene App-Rollenzugriffe geprüft. Bestehende Ziele und beschädigte Sicherungen wurden abgewiesen. Nach Migration 009 erneut gesichert und in eine neue Prüfdatenbank wiederhergestellt: alle 36 Tabellen/Fingerprints und 22 RLS-Tabellen einschließlich Policies identisch; Zugriffe nochmals geprüft. Dies ist ein lokaler Wiederherstellungsnachweis, keine Abnahme von externem Backup-Speicher, Verschlüsselung, RPO/RTO oder Katastrophenwiederanlauf.

Die Anwendung löscht bestätigte Unternehmensdaten per Tenant-Cascade. Kontoentfernung entfernt Identität, Sessions und Mitgliedschaften; bei Unternehmenslöschung kann die eigene letzte Identität durch eine gesonderte Checkbox ebenfalls gelöscht werden. Ohne dieses Opt-in bleibt ein erneutes Firmen-Onboarding nach Login möglich; frühere Inhalte verlieren ihre Autorenzuordnung. Lokales Postfach und Backups sind separate Speicher und benötigen ein festgelegtes Lösch-/Aufbewahrungskonzept. Die Double-Opt-in-Liste und Kontaktanfragen sind globale Vertriebsdaten; vor produktivem Vertrieb ist ein juristisch abgestimmter administrativer Auskunfts-/Löschprozess erforderlich.

## Beobachtbarkeit und Grenzen

Strukturierte API-Fehlerlogs enthalten Fehlertyp und DB-Fehlercode, keine eingegebenen Inhalte oder Geheimnisse. Ergänzen: zentraler Logtransport, Alarme für Job-/Mail-/KI-/Webhookfehler, DB-Metriken, Aufbewahrungsregeln und Supportprozess. Ein unabhängiger Penetrationstest und Lasttest sind vor Produktivfreigabe erforderlich. Die UI zeigt standardmäßig einen begrenzten neuesten Audit-Ausschnitt, der Export den vollständigen Verlauf.
