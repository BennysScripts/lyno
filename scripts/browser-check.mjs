import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000/");
await page.screenshot({
  path: "docs/screenshots/website-desktop.png",
  fullPage: true,
});
const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa"])
  .analyze();
console.log(
  JSON.stringify(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    null,
    2,
  ),
);
console.log("Page errors", errors);
await browser.close();
