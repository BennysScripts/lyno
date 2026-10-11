import { z } from "zod";
export const moduleIds = ["flow", "academy", "assist", "insights"] as const;
export type ModuleId = (typeof moduleIds)[number];
export const planIds = ["starter", "business", "premium"] as const;
export type PlanId = (typeof planIds)[number];
export const selectionSchema = z.object({
  plan: z.enum(planIds),
  modules: z
    .array(z.enum(moduleIds))
    .max(4)
    .refine(
      (v) => new Set(v).size === v.length,
      "Module dürfen nicht doppelt gewählt werden.",
    )
    .default([...moduleIds]),
});
export type Selection = z.infer<typeof selectionSchema>;
export const moduleCatalog = [
  {
    id: "flow",
    name: "Flow",
    description: "Prozesse, Aufgaben und Freigaben",
    price: 35,
  },
  {
    id: "academy",
    name: "Academy",
    description: "Wissen, Dokumente und Lernpfade",
    price: 35,
  },
  {
    id: "assist",
    name: "Assist",
    description: "Antworten und Entwürfe mit Quellen",
    price: 39,
  },
  {
    id: "insights",
    name: "Insights",
    description: "Auswertungen und Berichte",
    price: 29,
  },
] as const;
function euros(key: string, fallback: number) {
  const value =
    process.env[key] === undefined ? fallback : Number(process.env[key]);
  if (!Number.isFinite(value) || value <= 0 || value > 100000)
    throw new Error(`Ungültige Preis-Konfiguration: ${key}`);
  return Math.round(value * 100) / 100;
}
export function catalog() {
  const modules = moduleCatalog.map((m) => ({
    ...m,
    price: euros(`PRICE_${m.id.toUpperCase()}_EUR`, m.price),
  }));
  const plans = [
    {
      id: "starter" as const,
      name: "Starter",
      price: euros("PRICE_STARTER_EUR", 149),
      corePrice: euros("PRICE_CORE_STARTER_EUR", 49),
      seats: 15,
      automations: 3,
      aiDaily: 50,
      documentMB: 10,
      customRoles: false,
      description: "Für kleine Teams mit klaren Abläufen.",
    },
    {
      id: "business" as const,
      name: "Business",
      price: euros("PRICE_BUSINESS_EUR", 299),
      corePrice: euros("PRICE_CORE_BUSINESS_EUR", 199),
      seats: 50,
      automations: 25,
      aiDaily: 200,
      documentMB: 25,
      customRoles: true,
      description: "Mehr Spielraum für wachsende Unternehmen.",
    },
    {
      id: "premium" as const,
      name: "Premium",
      price: euros("PRICE_PREMIUM_EUR", 499),
      corePrice: euros("PRICE_CORE_PREMIUM_EUR", 399),
      seats: 150,
      automations: 100,
      aiDaily: 1000,
      documentMB: 50,
      customRoles: true,
      description: "Individuelle Strukturen mit höheren Limits.",
    },
  ];
  return { plans, modules, currency: "EUR", interval: "month", testMode: true };
}
export function quote(input: unknown) {
  const selection = selectionSchema.parse(input);
  const config = catalog();
  const plan = config.plans.find((p) => p.id === selection.plan)!;
  const modules = [...selection.modules].sort() as ModuleId[];
  const separate =
    plan.corePrice +
    config.modules
      .filter((m) => modules.includes(m.id))
      .reduce((s, m) => s + m.price, 0);
  const bundle = modules.length === moduleIds.length;
  return {
    ...selection,
    modules,
    bundle,
    amountCents: Math.round(
      (bundle ? Math.min(plan.price, separate) : separate) * 100,
    ),
    limits: plan,
  };
}
