# Kommerzieller Launch – offene externe Voraussetzungen

Es wurde kein produktives Deployment vorgenommen und keine rechtliche Freigabe erteilt.

## Vom Betreiber bereitzustellen

- Tatsächlicher Anbieter, Anschrift, Kontakt, Vertretung und gegebenenfalls Register-/Steuerangaben.
- Juristisch geprüfte Datenschutzinformation, Nutzungsvertrag/AGB, AVV, Rechtsgrundlagen, Datenlösch- und Aufbewahrungsfristen.
- Verbindliches Preis-/Paketmodell und Leistungsumfang. CORE 49/199/399 EUR, Vollbundles 149/299/499 EUR und Zusatzmodule sind konfigurierbare monatliche Nettopreisvorschläge. Startrabatt standardmäßig 20 Prozent für drei Monate und 20 Erstkundenplätze; Regeln und Erstkundendefinition rechtlich/kommerziell freigeben.
- Zielhosting, EU-/Drittlandentscheidung, Datenbank, TLS-Domain, DNS, sichere Geheimnisverwaltung und Zugriffsverantwortliche.
- Backup-Ziel, Wiederherstellungsnachweis, Monitoring, Alarmierung und Supportprozess.
- Gewünschter E-Mail-Anbieter und verifizierte Versanddomain. Ein SMTP-Adapter mit verschlüsselter Warteschlange, TLS und begrenzten Wiederholungen ist implementiert und mit gemocktem Transport geprüft. Ein echter SMTP-Dienst wurde nicht konfiguriert oder kontaktiert.
- Bei KI-Einsatz: genehmigter Anbieterzugang, Kostenrahmen, Auftragsverarbeitung und Prüfung der Kontextübertragung. Der vorhandene Adapter ist ohne Zugangsdaten nicht extern geprüft.
- Optional Stripe-Testkonto und Webhooksecret. Auswahlabhängige Testpreise erstellt der Adapter. Externe Integration noch nicht abgenommen. Ein Live-Zahlungsmodus ist bewusst nicht implementiert.

## Noch separat zu prüfen

- Unabhängige Sicherheitsprüfung, Last-/Ausfalltests und Wiederherstellung vom vorgesehenen verschlüsselten externen Backup-Speicher. Lokaler PostgreSQL-Restore mit 36 Tabellen und 22 RLS-Tabellen geprüft; kein Nachweis der späteren Infrastruktur oder RPO/RTO.
- Echte Geräte einschließlich Safari/iOS und assistive Technologien; die enthaltenen Browserprüfungen verwenden Chromium.
- E-Mail-Zustellbarkeit und gesamte externe Double-Opt-in-/Einladung-/Reset-Kette nach Konfiguration des Versandadapters.
- Reale Providerfehler, Stripe-Testwebhook-Reihenfolge/-Wiederholung, Aboänderungen und Supportfälle.
- Preisfreigabe, Vertragsabschluss, Einwilligungswiderruf und administrative Bearbeitung öffentlicher Vertriebsdaten.
- Den implementierten Wiederanlauf nach Providererfolg/DB-Fehler, Abgleich offener Stripe-Bestellungen und verlorener Ablaufwebhooks gegen ein echtes Stripe-Testkonto prüfen; Betreiberablauf für Fälle nach dem 22-Stunden-Wiederholungsfenster abnehmen. Lokale Signatur-, Konkurrenz- und Ausfalltests sind erfolgreich, ersetzen aber diese externe Prüfung nicht.
- Malware-Scanning für Dokumente; PDF-Download ist implementiert, automatische PDF-Auswertung/OCR nicht. Pseudonymes Käuferregister, Testpostfach und Backups brauchen ein abgestimmtes Aufbewahrungs-/Löschkonzept.
- Tatsächlicher Windows-/Docker-Desktop-Test der vorbereiteten PowerShell-Anleitung. Lokale Ausführung bisher unter Linux nachgewiesen.

Nicht im beschriebenen Kern enthalten: SSO/SAML, native Mobile-App, Echtzeit-Coediting, beliebige externe Integrationen, rechtsverbindliche Rechnungsstellung und Live-Zahlungseinzug. Diese Leistungen werden auf der Website nicht zugesagt. Dokument- und Logouploads sind enthalten.
