export const products = [
  {
    id: "core",
    name: "Core",
    eyebrow: "Die gemeinsame Grundlage",
    headline: "Ein Unternehmen. Ein verlässlicher Arbeitsraum.",
    description:
      "Menschen, Rollen und Einstellungen gehören zusammen. Core verbindet Ihr Team mit einer gemeinsamen Anmeldung und klar getrennten Firmenkonten.",
    features: [
      [
        "Menschen und Teams",
        "Mitarbeitende einladen, Teams bilden und Verantwortung durch Rollen eingrenzen.",
      ],
      [
        "Ihr eigener Rahmen",
        "Logo, Farben, Startseite und Widgets passend zu Ihrem Unternehmen gestalten.",
      ],
      [
        "Kontrolle behalten",
        "Änderungen im Audit nachvollziehen, Daten exportieren und Benachrichtigungen steuern.",
      ],
    ],
    scenario:
      "Ein neuer Mitarbeiter startet: Einladung, Team und passende Zugriffe stehen vor seinem ersten Arbeitstag bereit.",
  },
  {
    id: "flow",
    name: "Flow",
    eyebrow: "Von der Aufgabe zum verlässlichen Ablauf",
    headline: "Gute Prozesse brauchen keine Gedächtnisstütze.",
    description:
      "Machen Sie wiederkehrende Arbeit nachvollziehbar. Mit Formularen, Zuständigkeiten, Bedingungen und Freigaben in einem gemeinsamen Prozess.",
    features: [
      [
        "Prozesse gestalten",
        "Schritte, Formulare und Bedingungen im Editor zusammenstellen. Vorlagen für Onboarding, Qualität und interne Freigaben sind enthalten.",
      ],
      [
        "Verantwortung sichtbar machen",
        "Fristen, Prioritäten, Kommentare und Freigaben direkt am Vorgang bearbeiten.",
      ],
      [
        "Wiederholungen organisieren",
        "Regelmäßige Abläufe starten automatisch. Erinnerungen und gespeicherte Ansichten helfen im Tagesgeschäft.",
      ],
    ],
    scenario:
      "Ein neuer Kunde wird aufgenommen: Briefing erfassen, passende Schritte auslösen, Zugänge einrichten und die Übergabe freigeben.",
  },
  {
    id: "academy",
    name: "Academy",
    eyebrow: "Firmenwissen, das erreichbar bleibt",
    headline: "Die Antwort ist schon im Team. Geben Sie ihr einen Ort.",
    description:
      "Halten Sie Anleitungen und Erfahrungen fest. Verbinden Sie Artikel und Dokumente mit Lernpfaden und den Prozessen, in denen sie gebraucht werden.",
    features: [
      [
        "Wissen pflegen",
        "Artikel mit Markdown, Vorschau und Kategorien. Dokumente als geschützte PDF- und Textdownloads.",
      ],
      [
        "Zugriffe gezielt vergeben",
        "Inhalte für das Unternehmen, einzelne Teams oder das Management freigeben.",
      ],
      [
        "Einarbeitung begleiten",
        "Geordnete Lernpfade und Checklisten mit persönlichem Fortschritt. Wissen direkt mit Flow verknüpfen.",
      ],
    ],
    scenario:
      "Neue Kollegen lernen das Ticketsystem mit einem Lernpfad kennen und finden die passende Anleitung direkt im Arbeitsprozess.",
  },
  {
    id: "assist",
    name: "Assist",
    eyebrow: "Antworten mit nachvollziehbaren Quellen",
    headline: "Firmenwissen fragen. Die Entscheidung behalten.",
    description:
      "Assist findet zugängliches Wissen, fasst Texte zusammen und schlägt Prozesse vor. Sie prüfen die Quellen und entscheiden über jeden Entwurf.",
    features: [
      [
        "Berechtigtes Wissen",
        "Antworten verwenden ausschließlich zugängliche Quellen aus Ihrer Firma.",
      ],
      [
        "Überprüfbare Ergebnisse",
        "Quellen öffnen, Zusammenfassungen lesen und Workflow-Entwürfe vor dem Speichern bearbeiten.",
      ],
      [
        "Nutzung begrenzen",
        "Tageslimits je Paket und Firma. Ohne API-Zugang ausdrücklich gekennzeichneter lokaler Testmodus.",
      ],
    ],
    scenario:
      "Vor einer Kundenübergabe fasst Assist die interne Checkliste zusammen und verlinkt die zugrunde liegenden Artikel.",
  },
  {
    id: "insights",
    name: "Insights",
    eyebrow: "Verstehen, wo Arbeit wartet",
    headline: "Bessere Entscheidungen beginnen bei Ihren Abläufen.",
    description:
      "Sehen Sie, welche Prozesse laufen, wie lange abgeschlossene Vorgänge dauern und wo Aufgaben offen bleiben. Mit realen Daten aus Ihrem Arbeitsraum.",
    features: [
      [
        "Echte Prozessdaten",
        "Abschlussquoten, Durchlaufzeiten, überfällige Aufgaben und Prozessvergleiche.",
      ],
      [
        "Zeit und Zusammenhänge",
        "Zeitreihen und Zeitraumfilter zeigen Entwicklungen ohne erfundene Vergleichswerte.",
      ],
      [
        "Erkenntnisse teilen",
        "Berichte als CSV exportieren und Filter für Ihre Auswertung wählen. Leere Datensätze bleiben als solche erkennbar.",
      ],
    ],
    scenario:
      "Die Teamleitung prüft offene Freigaben und lange laufende Prozesse vor der Wochenplanung.",
  },
] as const;
