import { describe, it, expect } from "vitest";
import {
  templateSchema,
  validateForm,
  stepEnabled,
  stepSchema,
} from "../src/lib/flow";
import { checkOrigin, AppError } from "../src/lib/security";
describe("Formular- und Prozessvalidierung", () => {
  it("erzwingt Pflichtfelder und korrekte Typen", () => {
    const fields = [
      { key: "kunde", label: "Kunde", type: "text" as const, required: true },
      {
        key: "anzahl",
        label: "Anzahl",
        type: "number" as const,
        required: false,
      },
    ];
    expect(() => validateForm(fields, {})).toThrow("Kunde");
    expect(() => validateForm(fields, { kunde: 42 })).toThrow("Text");
    expect(() => validateForm(fields, { kunde: "Acme", anzahl: "10" })).toThrow(
      "Zahl",
    );
    expect(validateForm(fields, { kunde: "Acme", unknown: "discard" })).toEqual(
      { kunde: "Acme" },
    );
  });
  it("wendet Bedingungen strikt und vorhersehbar an", () => {
    const step = stepSchema.parse({
      title: "Zugang",
      kind: "task",
      condition: { field: "access", equals: true },
    });
    expect(stepEnabled(step, { access: true })).toBe(true);
    expect(stepEnabled(step, { access: "true" })).toBe(false);
    expect(stepEnabled(step, {})).toBe(false);
  });
  it("verhindert ungültige Vorlagen und unbeaufsichtigt unvollständige Wiederholungen", () => {
    const base = {
      name: "Prozess",
      steps: [{ title: "Schritt", kind: "task" }],
      fields: [{ key: "kunde", label: "Kunde", type: "text", required: true }],
    };
    expect(
      templateSchema.safeParse({
        ...base,
        fields: [...base.fields, ...base.fields],
      }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({ ...base, recurrenceDays: 7 }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({
        ...base,
        recurrenceDays: 7,
        fields: [{ ...base.fields[0], default: "Testkunde" }],
      }).success,
    ).toBe(true);
    expect(
      templateSchema.safeParse({
        ...base,
        steps: [
          {
            title: "Schritt",
            kind: "task",
            condition: { field: "fremd", equals: true },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("weist Cross-Origin-Schreibversuche und fehlende Origins ab", () => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/workflows", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow(AppError);
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/workflows", { method: "POST" }),
      ),
    ).toThrow(AppError);
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/workflows", {
          method: "POST",
          headers: { origin: process.env.APP_URL || "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
});

describe("Paketberechtigungen", () => {
  it("beendet die Testphase exakt zum Ablauf und respektiert Kündigungen", async () => {
    const { hasAccess } = await import("../src/lib/access");
    const now = Date.now();
    const base = {
      subscription_status: "trialing",
      trial_ends_at: new Date(now + 1000),
      period_ends_at: null,
      cancel_at_period_end: false,
    };
    expect(hasAccess(base, now)).toBe(true);
    expect(hasAccess(base, now + 1000)).toBe(false);
    expect(hasAccess({ ...base, subscription_status: "canceled" }, now)).toBe(
      false,
    );
    expect(hasAccess({ ...base, subscription_status: "past_due" }, now)).toBe(
      false,
    );
    expect(
      hasAccess(
        {
          ...base,
          subscription_status: "active",
          cancel_at_period_end: true,
          period_ends_at: new Date(now - 1),
        },
        now,
      ),
    ).toBe(false);
    expect(
      hasAccess(
        {
          ...base,
          subscription_status: "active",
          cancel_at_period_end: false,
          period_ends_at: new Date(now - 1),
        },
        now,
      ),
    ).toBe(true);
  });
});
