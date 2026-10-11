# OpenDesign: Sicherheits- und Kompatibilitätsprüfung

Geprüft am 11.10.2026: https://github.com/nexu-io/open-design, Commit `17e255959703a3fad7c8eb7f7b70dcafccc5629a`, Version 0.23.1. Read-only-Klon in temporärem Verzeichnis; keine fremden Programme oder Installer ausgeführt.

## Entscheidung

Der reine Textskill `skills/frontend-design` ist für Next.js/React und vorhandene Designsysteme geeignet. Er wurde samt unveränderter Apache-2.0-Lizenz projektlokal unter `.agents/skills/open-design-frontend/` installiert. Kein NPM-Paket, keine neue Runtime-Abhängigkeit, keine Telemetrie und keine Zugangsdaten nötig. SKILL.md vollständig gelesen: konkrete Typografie/Layouts, semantische Bedienung, Zustände, ehrliche Inhalte, responsive Gestaltung und Vorrang der Nutzervorgaben. Keine Shellbefehle, Downloads, Netzwerkaktionen oder Geheimniszugriffe im installierten Skill. SHA-256-Dateiprüfung: Kopien entsprechen dem geprüften Commit.

Die vollständige Anwendung wurde nicht installiert: Monorepo mit eigenem Daemon, MCP-/Agenten-Adaptern, nativen Build-Abhängigkeiten und automatisch ausgeführtem `scripts/postinstall.mjs`. README beschreibt eigene kommerzielle Angebote; PRIVACY.md dokumentiert standardmäßig aktivierte Produkttelemetrie und einen gesonderten Diagnosekanal bei konfigurierter Destination. Diese Infrastruktur ist für das lokale LYNO-Design unnötig. Das ist keine Behauptung über Schadcode, sondern eine Begrenzung des geprüften/installierten Umfangs.

## Grenzen

Statische Prüfung der installierten Skilldateien und relevanter Projektmetadaten; keine vollständige Sicherheitszertifizierung des gesamten fremden Monorepos oder seiner transitiven Abhängigkeiten. Künftige Updates vor Übernahme erneut prüfen, keine automatische Aktualisierung. Fremde Beispiele, Markenassets oder Screenshots wurden nicht in LYNO übernommen. Referenzbilder des Nutzers fehlen weiterhin.
