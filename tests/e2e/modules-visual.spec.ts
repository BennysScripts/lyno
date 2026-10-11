import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("Alle Fachmodule: Light/Dark, Kontraste, Navigation und Bildschirmbreite", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/anmelden");
  await page
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill("lea@lyno.example");
  await page.getByLabel("Passwort", { exact: true }).fill("Lyno-Demo-2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await mkdir("docs/screenshots", { recursive: true });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Dunklen Modus aktivieren" })
        .click();
    for (const module of ["flow", "academy", "assist", "insights"]) {
      await page.goto(`/app/${module}`);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations, `${module}, ${theme}`).toEqual([]);
      if (info.project.name !== "tablet")
        await page.screenshot({
          path: `docs/screenshots/${module}-${theme}-${info.project.name}.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  }
  expect(errors).toEqual([]);
});
