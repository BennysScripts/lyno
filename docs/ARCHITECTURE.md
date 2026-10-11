# Architektur

## Laufzeit und Zuständigkeiten

LYNO ist ein modularer Monolith. Next.js rendert Website und Anwendung, React steuert Formulare, Dialoge und Diagramme. API-Handler delegieren an serverseitige Fachmodule; sie prüfen Origin, Session und die aktuelle Firmenmitgliedschaft. Zod validiert Eingaben; pg führt ausschließlich parametrisierte Werte aus. Alle Fachdaten leben in PostgreSQL, nicht in Local Storage. Im Browser wird nur die Darstellungspräferenz gespeichert.

## Authentifizierung

bcrypt mit Kostenfaktor 12 schützt Passwörter. Sessions und Einmaltoken bestehen aus 32 kryptografisch zufälligen Bytes; die Datenbank speichert nur SHA-256-Hashes. Sessions verfallen nach sieben Tagen, Reset-Links nach 30 Minuten, Verifizierungslinks nach zwei Tagen. Passwortreset löscht alle vorhandenen Sessions. Cookies sind HttpOnly, SameSite=Lax und bei HTTPS Secure. Schreibende Browseranfragen benötigen den exakt konfigurierten Origin. Der Stripe-Webhookspezialfall verwendet stattdessen eine kryptografische Signatur.

Öffentliche Authentifizierungsaktionen sind persistent pro Identität gedrosselt. Passwörter, Token und Artikelinhalte werden nicht in Audit-Ereignisse übernommen. Kein Login über Demo-Bypass: Auch der Seed-Nutzer durchläuft die echte Authentifizierung.

## Mandantentrennung

Jede Unternehmensressource besitzt `tenant_id`. Anwendungsqueries enthalten Firmenfilter; zusammengesetzte Fremdschlüssel verhindern Beziehungen zwischen Firmen. Tenant-Transaktionen setzen `app.tenant_id` mit transaktionslokalem `set_config`. PostgreSQL-RLS filtert zusätzlich Teams, Wissen, Vorlagen, Abläufe, Aufgaben, Kommentare, Benachrichtigungen, Audit und Abrechnung. Ohne Tenant-Kontext sind diese Tabellen für die Anwendung unsichtbar.

`lyno_app` ist eine eingeschränkte Login-Rolle ohne Superuser-/BYPASSRLS-Rechte. Migrationen laufen über eine getrennte administrative Verbindung. Nutzeridentitäten, Sessions, Organisationen, Mitgliedschaften, Rate-Limits und öffentliche Anmeldungen sind globale Tabellen und werden zentral im Backend autorisiert. Dies ist keine Behauptung, dass die gesamte Datenbank vor einem kompromittierten Anwendungsprozess geschützt wäre. Das Geheimnis der administrativen DB-Verbindung darf im späteren Webdienst nicht vorhanden sein.

Eine eng begrenzte SECURITY-DEFINER-Funktion findet Einladungen nur anhand eines 256-Bit-Tokens und der verifizierten Empfängeradresse. Ihr `search_path` ist festgelegt; Ausführung ist nur der Anwendungsrolle erlaubt.

## Rechte

| Aktion                                                      | Inhaber | Admin         | Management | Mitglied                  | Lesend                    |
| ----------------------------------------------------------- | ------- | ------------- | ---------- | ------------------------- | ------------------------- |
| Firmeninhalte lesen                                         | ja      | ja            | ja         | gemäß Wissenssichtbarkeit | gemäß Wissenssichtbarkeit |
| Aufgaben/Kommentare/Einarbeitung bearbeiten                 | ja      | ja            | ja         | eigene/offene Aufgaben    | nein                      |
| Prozesse starten                                            | ja      | ja            | ja         | ja                        | nein                      |
| Vorlagen, Artikel, Freigaben verwalten                      | ja      | ja            | ja         | nein                      | nein                      |
| Teams/Einladungen/Mitglieder verwalten                      | ja      | eingeschränkt | nein       | nein                      | nein                      |
| Inhaber/Adminrollen vergeben                                | ja      | nein          | nein       | nein                      | nein                      |
| Unternehmensdaten exportieren, Firma löschen, Abo verwalten | ja      | nein          | nein       | nein                      | nein                      |

Management sieht sämtliche Wissensartikel seiner Firma. Andere Rollen sehen Unternehmensartikel und Artikel ihrer Teams. Diese Auswahl gilt gleichermaßen für Artikeldetails, Checklisten und Assist. Firmenweite Prozesse sind innerhalb der Firma sichtbar; sie besitzen keine zusätzliche vertrauliche Teamsichtbarkeit.

## Prozessmodell

Eine Vorlage enthält validierte, sortierte Schrittdefinitionen und Formularfelder. Beim Start werden Pflichtfelder, Datentypen und Bedingungen ausgewertet; jeder Schritt wird als eigenständiger Aufgaben-Datensatz gespeichert. Nicht zutreffende Schritte werden übersprungen. Der erste zutreffende Schritt wird bereit, weitere warten. Nur bereite Aufgaben sind abschließbar. Freigaben benötigen Managementrechte. Ablehnung beendet den Ablauf; der letzte erfolgreiche Schritt schließt ihn ab. Bereits gestartete Schritte werden durch Vorlagenänderungen nicht rückwirkend verändert.

Statuswechsel sperren den zugehörigen Workflow und die Aufgabe transaktional. Gleichzeitige Abschlüsse führen höchstens einmal zum nächsten Zustand. Zuweisungen müssen auf aktuelle Firmenmitglieder zeigen. Fachliche Änderungen erzeugen Audit-Einträge; persönliche Lesemarkierungen und Checklistenfortschritte sind davon ausgenommen. Erinnerungen und Wiederholungen laufen über einen separaten idempotenten Worker. Die Ablaufliste bietet serverseitige Such-/Status-/Prioritätsfilter und 25 Einträge je Seite. Detailansichten laden auch ältere Abläufe und deren vollständigen Prozessverlauf.

## Wissen, Assist und Auswertungen

Artikel werden als Markdown gespeichert und ohne Raw-HTML-Ausführung gerendert. Suchanfragen laufen im zulässigen Firmenwissen. Assist ordnet zugängliche Artikel nach passenden Begriffen und begrenzt den Kontext. Im Standard-Testmodus gibt er Originalauszüge oder extraktive Zusammenfassungen aus. Prozessentwürfe sind allgemeine Vorschläge und werden erst durch einen berechtigten Nutzer im Editor gespeichert.

Der optionale OpenAI-Adapter hat Timeout, eingeschränkte Ausgabe, JSON-Validierung, Quellenprüfung und keinerlei Ausführungstools. Kontext und Nutzertext werden als untrusted Daten behandelt. Tageskontingente gelten unternehmensweit. Abgelaufene Testphasen und gekündigte Laufzeiten verhindern weitere fachliche Schreiboperationen; Lesen, Export und Paketverwaltung bleiben möglich. Vertrauliche Daten werden im lokalen Testmodus nicht übertragen.

Insights berechnet Zählungen, Abschlussquote, Durchschnittsdauer und Engpässe aus gespeicherten Prozessen. Der Zeitraum filtert nach Prozessstart; die Zeitreihe zeigt gestartete Abläufe und die inzwischen abgeschlossenen derselben Startkohorte. „Prozessalter“ ist keine vorgetäuschte Messung der Liegezeit eines Schritts. Fehlende Durchschnittswerte werden als „—“ angezeigt.

## Gestaltung

Weiß, Marine und zurückhaltendes Blau bilden das LYNO-Designsystem nach den sechs bereitgestellten Referenzen. DM Sans ist lokal eingebunden. CSS-Variablen unterstützen Light/Dark Mode; Firmen können Logo, Akzent und Begrüßung anpassen. Native Dialoge übernehmen Fokusbegrenzung und Escape-Verhalten; Formulare haben sichtbare Beschriftungen, Fehlermeldungen und Ladezustände. Reduzierte Bewegung wird respektiert. Gestaltungsabgleich und geprüfter lokaler Skill: `DESIGN.md` und `OPEN_DESIGN_REVIEW.md`.

## Produktmodell und Anpassungen

`catalog.ts` ist die zentrale Quelle für Starter/Business/Premium, CORE und vier Zusatzmodule, Preise und Limits. `entitlements.ts` prüft Buchung, Laufzeit und Kapazität; Rollen- und Inhaltsrechte gelten zusätzlich. `customization.ts` verwaltet Firmenoptionen und benutzerdefinierte Rollen. Individuelle Rechte sind stets eine Schnittmenge mit der Grundrolle, keine Eskalation. Server und API lesen Mitgliedschaft und Zusatzrechte frisch ein.

Checkout-Bestellungen speichern die konkrete Auswahl und Preis-/Rabattwerte. Erst eine explizite lokale Testbestätigung oder ein verifizierter Stripe-Zahlungsbeleg aktualisiert die freigeschalteten Module. Webhook-IDs werden in derselben Datenbanktransaktion wie die Verarbeitung gespeichert. Rabattplätze werden unter einer gemeinsamen PostgreSQL-Sperre reserviert; Käuferhistorie und aktive Reservierungen bestimmen den Zähler. Externe Provideroperationen und PostgreSQL sind nicht atomar; Abgleich und Wiederanlauf müssen vor Produktivfreigabe weiter abgesichert werden.

Geschützte Dokumente, geordnete Lernpfade, persönlicher Fortschritt, Zusatzrollen, Präferenzen und Bestellungen verwenden ebenfalls RLS und zusammengesetzte Fremdschlüssel. Firmenkonfiguration wird in validiertem JSON gespeichert. Globale Suche filtert Module und Wissenssichtbarkeit. CSV-Berichte verwenden echte Prozessdaten und schützen Tabellenzellen vor Formelausführung.

## Lieferkette und Releasepaket

Der Lockfile fixiert den geprüften Abhängigkeitsstand. Ein Postbuild-Schritt kopiert statische Assets in das Standalone-Verzeichnis und entfernt Next.js-generierte Kopien von Umgebungsdateien und Postfachdaten. Eine nonce-basierte Content Security Policy erlaubt Skripte nur aus dem jeweiligen serverseitigen Dokument; `unsafe-eval` gilt ausschließlich im Entwicklungsmodus. Stilattribute bleiben für Diagramme und Fortschrittsanzeigen erlaubt.

## Versand

Lokale Nachrichten liegen mit restriktiven Dateirechten im Testpostfach. Der ausdrücklich aktivierbare SMTP-Adapter verschlüsselt Nachrichteninhalte mittels AES-256-GCM und getrenntem Laufzeitschlüssel. Ein Worker verarbeitet fällige Outboxeinträge mit `FOR UPDATE SKIP LOCKED`, stabiler Message-ID, TLS und höchstens fünf Zustellversuchen. Im Erfolgsfall wird der Nachrichteninhalt entfernt. Versand bleibt At-least-once und erfordert vor externer Nutzung Betreiberkonfiguration und eine Zustellbarkeitsprüfung.
