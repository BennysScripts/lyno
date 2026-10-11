import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readdir, readFile } from "node:fs/promises";
const origin = { origin: "http://localhost:3000" };
test("Module, Paketwahl und Übernahme in die Registrierung", async ({
  page,
}) => {
  for (const module of ["core", "flow", "academy", "assist", "insights"]) {
    await page.goto(`/module/${module}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/module/assist");
  await page.getByRole("link", { name: "LYNO Assist ausprobieren" }).click();
  await expect(page).toHaveURL(/modules=assist/);
  await page.goto("/preise");
  await page.getByLabel("Academy +35 €").uncheck();
  await page.getByLabel("Insights +29 €").uncheck();
  await page.getByRole("link", { name: "14 Tage ausprobieren" }).nth(2).click();
  await expect(page.getByLabel("Paket für Ihre Testphase")).toHaveValue(
    "premium",
  );
  await expect(page).toHaveURL(/modules=flow,assist/);
  await page.goto("/anwendungsfaelle");
  await expect(
    page.getByRole("heading", { name: "Qualitätsprüfung", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dunklen Modus aktivieren" }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});
test("Firmenanpassung, Suche, Dokumente, Lernpfade, Ansichten und Berichte", async ({
  page,
}, info) => {
  const email = `extensions.${info.project.name}.${Date.now()}@tests.example`;
  const r = await page.request.post("/api/auth/register", {
    headers: origin,
    data: {
      name: "Robin Erweiterung",
      email,
      password: "Browser-Lyno-2026!",
      company: "Erweiterungsfirma",
      plan: "business",
    },
  });
  expect(r.status()).toBe(200);
  let raw = "";
  for (const file of (await readdir(".local/mail")).sort().reverse()) {
    const m = JSON.parse(await readFile(`.local/mail/${file}`, "utf8"));
    if (m.to === email) {
      raw = new URL(m.text).searchParams.get("token")!;
      break;
    }
  }
  expect(
    (
      await page.request.post("/api/auth/verify", {
        headers: origin,
        data: { token: raw },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Anpassungen", exact: true }).click();
  await page
    .getByLabel("Begrüßung", { exact: true })
    .fill("Ein Team. Klare Schritte.");
  await page.getByLabel("Flow: Standardansicht").selectOption("board");
  await page.getByLabel("Startseite", { exact: true }).selectOption("academy");
  await page.getByLabel("Kennzahlen", { exact: true }).check();
  await page
    .getByRole("button", { name: "Firmenanpassungen speichern" })
    .click();
  await expect(page.getByRole("status")).toContainText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Anpassungen", exact: true }).click();
  await expect(page.getByLabel("Begrüßung", { exact: true })).toHaveValue(
    "Ein Team. Klare Schritte.",
  );
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/academy$/);
  await page.goto("/app?overview=1");
  await expect(page.getByText("Ein Team. Klare Schritte.")).toBeVisible();
  await page.goto("/app/learning");
  await page.getByRole("button", { name: "Dokument hochladen" }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Titel", { exact: true })
    .fill("Projektwissen aus Datei");
  await modal.getByLabel("Datei", { exact: true }).setInputFiles({
    name: "wissen.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Unsere Projektübergabe wird durch das Management freigegeben.",
    ),
  });
  await modal.getByRole("button", { name: "Dokument speichern" }).click();
  await expect(page.getByRole("link", { name: "wissen.txt" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "wissen.txt" }).click();
  expect((await download).suggestedFilename()).toBe("wissen.txt");
  await page.getByRole("button", { name: "Lernpfad erstellen" }).click();
  await modal.getByLabel("Titel", { exact: true }).fill("Einstieg Projektteam");
  await modal
    .getByLabel("Artikel hinzufügen")
    .selectOption({ label: "Projektwissen aus Datei" });
  await modal.getByRole("button", { name: "Lernpfad speichern" }).click();
  await page.getByRole("button", { name: "Als gelernt markieren" }).click();
  await expect(page.getByText("1 von 1 Schritten abgeschlossen")).toBeVisible();
  await page.getByRole("button", { name: "Global suchen" }).click();
  await modal.getByLabel("Suchbegriff").fill("Projektwissen");
  await modal.getByRole("button", { name: "Suchen", exact: true }).click();
  await expect(
    modal.getByRole("link", { name: "Artikel Projektwissen aus Datei" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/app/flow");
  await expect(
    page.getByRole("button", { name: "Liste anzeigen" }),
  ).toBeVisible();
  await page.getByLabel("Nach Status filtern").selectOption("completed");
  await page.getByRole("button", { name: "Ansicht speichern" }).click();
  await modal.getByLabel("Name der Ansicht").fill("Abgeschlossene Arbeit");
  await modal.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page
      .getByLabel("Gespeicherte Ansicht")
      .getByRole("option", { name: "Abgeschlossene Arbeit" }),
  ).toHaveCount(1);
  await page.goto("/app/insights");
  const report = await page.request.get("/api/insights/report?days=30");
  expect(report.status()).toBe(200);
  expect(report.headers()["content-type"]).toContain("text/csv");
  expect(await report.text()).toContain("Durchschnitt Stunden");
  await page.goto("/app/settings");
  await page
    .getByRole("button", { name: "Individuelle Rollen", exact: true })
    .click();
  await page.getByRole("button", { name: "Rolle erstellen" }).click();
  await modal.getByLabel("Rollenname").fill("Wissensleser");
  await modal.getByLabel("Wissen lesen", { exact: true }).check();
  await modal.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Wissensleser", { exact: true })).toHaveCount(2);
  for (const path of ["/app/learning", "/app/settings?tab=billing"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  }
});
