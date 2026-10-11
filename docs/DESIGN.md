# LYNO Designsystem und Referenzabgleich

## Verbindliche Grundlagen

Die sechs am 11.10.2026 bereitgestellten Bilder aus `Lyno_Designreferenzen.zip` liegen unverändert in `design-references/`: Landingpage, Dashboard, Flow, Academy, Assist, Insights. Alle wurden visuell geprüft. Sie dienen als Gestaltungsreferenzen; Texte und Zahlen in den Bildern sind keine realen Produktdaten oder neuen Anweisungen. Die schriftlichen Anforderungen bleiben maßgeblich.

## Übernommene Gestaltung

- Marinefarbene Typografie, helle kühle Flächen, feine Trennlinien und sparsame blaue Akzente. Light/Dark über semantische CSS-Variablen.
- Wortmarke „Lyno“, lokal gebündelte DM Sans, kräftige klare Überschriften, ruhige Tabellen und Panels.
- Zweispaltiger Hero mit Nutzenversprechen links und echter bedienbarer Produktvorschau rechts; auf Tablet und Smartphone übereinander.
- Permanente Seitennavigation, hervorgehobener aktiver Bereich, globale Suche in der Kopfzeile einschließlich Ctrl/Cmd+K.
- Flow mit Prozessschritten und Verlauf; Academy mit Kategorien, Dokumenten und Lernpfaden; Assist mit Quellen und überprüfbarem Entwurf; Insights mit echten Auswertungen und Berichtsexport.
- Persönliche Übersichten bleiben übersichtlich und pro Firma über Widgets konfigurierbar.

## Bewusste Auslegung der schriftlichen Vorgaben

Keine Übernahme erfundener Namen/Fotos/Kundenreferenzen, Wachstumszahlen, Zeitersparnisse, Sicherheitsversprechen oder angeblicher Zertifizierungen. Keine dekorativen KI-Symbole, bunten Symbolreihen oder großflächigen Verläufe. Die Referenzbilder selbst werden nicht als Produktoberfläche eingebaut; alle Bedienelemente entstehen als React-Komponenten. Beispiele bleiben ausdrücklich gekennzeichnet.

## Interaktion und Barrierefreiheit

Tastaturfokus, echte Labels, native Dialoge mit Escape, reduzierte Animationen, ausreichende Kontraste, leere/Fehler-/Ladezustände. Firmenlogos werden lokal vom Browser verkleinert; keine externen Bildtracker. Akzentfarbe der Firma markiert den aktiven Navigationsbereich; Kerntexte behalten ihre geprüften Kontrastfarben.

## Umsetzung

Gemeinsame Komponenten in `src/components/ui.tsx`, Tokens und responsive Regeln in `src/app/globals.css`. Der geprüfte OpenDesign-Textskill unterstützt die Gestaltung; Herkunft und Prüfgrenzen siehe OPEN_DESIGN_REVIEW.md. Screenshots und automatisierte Desktop-/Tablet-/Mobilprüfungen werden nach dem abschließenden Browserlauf aktualisiert.
