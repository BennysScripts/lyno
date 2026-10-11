import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
if (process.env.LYNO_ISOLATED_TEST !== "1")
  throw new Error(
    "Bitte npm run test:e2e verwenden: Browsertests erhalten eine eigene Datenbank und einen eigenen Webserver.",
  );
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1194 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: process.env.E2E_PRODUCTION ? "npm start" : "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
