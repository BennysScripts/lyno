export const starterTemplates = [
  {
    name: "Kunden-Onboarding",
    description:
      "Vom ersten Briefing bis zur Übergabe. Ein verlässlicher Start für neue Kunden.",
    fields: [
      { key: "kunde", label: "Kundenname", type: "text", required: true },
      {
        key: "zugang",
        label: "Technischen Zugang einrichten?",
        type: "checkbox",
        required: false,
      },
    ],
    steps: [
      {
        title: "Kick-off vorbereiten",
        description: "Ziele, Ansprechpartner und Zeitplan dokumentieren.",
        kind: "task",
        dueDays: 1,
      },
      {
        title: "Zugänge einrichten",
        description: "Berechtigungen prüfen und Zugang sicher übergeben.",
        kind: "task",
        dueDays: 2,
        condition: { field: "zugang", equals: true },
      },
      {
        title: "Onboarding freigeben",
        description: "Vollständigkeit kontrollieren und Übergabe bestätigen.",
        kind: "approval",
        dueDays: 3,
      },
    ],
  },
  {
    name: "Qualitätsprüfung",
    description: "Reproduzierbare Qualitätskontrolle vor jeder Auslieferung.",
    fields: [
      {
        key: "projekt",
        label: "Projekt / Prüfgegenstand",
        type: "text",
        required: true,
      },
    ],
    steps: [
      {
        title: "Prüfung durchführen",
        description:
          "Anforderungen und dokumentierte Prüfkriterien abgleichen.",
        kind: "task",
        dueDays: 1,
      },
      {
        title: "Ergebnis dokumentieren",
        description:
          "Befunde und gegebenenfalls Korrekturen als Kommentar erfassen.",
        kind: "task",
        dueDays: 2,
      },
      {
        title: "Qualität freigeben",
        description: "Verantwortliche Person prüft die Ergebnisse.",
        kind: "approval",
        dueDays: 3,
      },
    ],
  },
  {
    name: "Interne Freigabe",
    description: "Entscheidungen nachvollziehbar einholen und dokumentieren.",
    fields: [
      { key: "anliegen", label: "Anliegen", type: "text", required: true },
      {
        key: "betrag",
        label: "Betrag in EUR (optional)",
        type: "number",
        required: false,
      },
    ],
    steps: [
      {
        title: "Entscheidungsgrundlage vorbereiten",
        description:
          "Informationen und Empfehlung in einem Kommentar zusammenfassen.",
        kind: "task",
        dueDays: 1,
      },
      {
        title: "Freigabe entscheiden",
        description: "Management entscheidet über die Umsetzung.",
        kind: "approval",
        dueDays: 2,
      },
    ],
  },
];
