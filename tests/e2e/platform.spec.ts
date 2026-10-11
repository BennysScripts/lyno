import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readdir, readFile, mkdir } from "node:fs/promises";
async function verifyToken(email: string) {
  for (const f of (await readdir(".local/mail")).sort().reverse()) {
    const mail = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
    if (mail.to === email && mail.subject.includes("E-Mail-Adresse bestätigen"))
      return new URL(mail.text).searchParams.get("token")!;
  }
  throw new Error("Bestätigung fehlt");
}
test("Marketing: Demo, Navigation, mobile Darstellung und Tastaturzugänglichkeit", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Weniger Abstimmung. Mehr Fortschritt.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Produktdemo öffnen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 3; i++)
    await dialog.getByRole("button", { name: "Schritt abschließen" }).click();
  await expect(
    dialog.getByText("Gut gemacht. Der Ablauf ist abgeschlossen."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Neu starten" }).click();
  await expect(
    dialog.getByRole("button", { name: "Schritt abschließen" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/website-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  await page.getByRole("link", { name: "Kontakt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was können wir für Sie tun?" }),
  ).toBeVisible();
});
test("Registrierung, E-Mail-Bestätigung, Flow, Wissen, Assist, Export und Testabo", async ({
  page,
}, testInfo) => {
  const email = `browser.${testInfo.project.name}.${Date.now()}@tests.example`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/registrieren");
  await page.getByLabel("Ihr Name", { exact: true }).fill("Alex Browsertest");
  await page
    .getByLabel("Unternehmen", { exact: true })
    .fill("Browser Testfirma");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill("Browser-Lyno-2026!");
  await page.getByRole("button", { name: "Arbeitsraum erstellen" }).click();
  await expect(page).toHaveURL(/\/app\?welcome=1/);
  await expect(
    page.getByRole("heading", { name: /Guten Tag, Alex/ }),
  ).toBeVisible();
  const raw = await verifyToken(email);
  await page.goto(`/bestaetigen?type=verify&token=${raw}`);
  await page.getByRole("button", { name: "Anmeldung bestätigen" }).click();
  await expect(
    page.getByText("Ihre E-Mail-Adresse ist bestätigt."),
  ).toBeVisible();
  await page.goto("/app/flow");
  await page
    .getByRole("button", { name: "Ablauf starten", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Vorlage", { exact: true })
    .selectOption({ label: "Kunden-Onboarding" });
  await modal.getByLabel("Name des Ablaufs").fill("Kunde Morgen · Onboarding");
  await modal.getByLabel("Kundenname *").fill("Kunde Morgen");
  await modal
    .getByRole("button", { name: "Ablauf starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Kunde Morgen · Onboarding",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Übersprungen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abschließen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Freigeben", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ihr Kommentar")
    .fill("Alle Voraussetzungen wurden geprüft.");
  await page.getByRole("button", { name: "Kommentar hinzufügen" }).click();
  await expect(
    page.getByText("Alle Voraussetzungen wurden geprüft."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Freigeben", exact: true }).click();
  await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible();
  await page.goto("/app/academy");
  await page.getByRole("button", { name: "Artikel erstellen" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Titel", { exact: true })
    .fill("Unser Browserwissen");
  await page
    .getByRole("dialog")
    .getByLabel("Inhalt", { exact: true })
    .fill(
      "# Browserwissen\n\nUnser Team dokumentiert jede Übergabe in LYNO Flow.",
    );
  await page.getByRole("button", { name: "Artikel speichern" }).click();
  await page.getByRole("link", { name: /Unser Browserwissen/ }).click();
  await expect(
    page.getByRole("heading", { name: "Browserwissen", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mit Assist zusammenfassen" }).click();
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(
    page.getByText(/Lokale extraktive Zusammenfassung/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /1. Unser Browserwissen/ }),
  ).toBeVisible();
  await page.goto("/app/settings?tab=billing");
  await page.getByRole("button", { name: "Auswahl buchen" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Bestellung vorbereiten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bestellung überprüfen" }),
  ).toBeVisible();
  await page
    .getByLabel("Ich bestätige diese simulierte Zahlung ohne Geldeinzug.")
    .check();
  await page
    .getByRole("button", { name: "Testzahlung bestätigen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bestellung überprüfen" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Zum Laufzeitende kündigen" }).click();
  await expect(
    page.getByText("Kündigung vorgemerkt.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kündigung zurücknehmen" }).click();
  const exported = await page.request.get("/api/export");
  expect(exported.status()).toBe(200);
  const data = await exported.json();
  expect(data.organization.name).toBe("Browser Testfirma");
  expect(data.workflows).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain("password_hash");
  await page.goto("/app/insights");
  await expect(
    page.getByRole("heading", { name: "Verstehen, was Arbeit bewegt." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("API: Authentifizierung, Origin-Schutz und fremde Firmenressourcen", async ({
  request,
  browser,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email: "lea@lyno.example", password: "Lyno-Demo-2026!" },
      })
    ).status(),
  ).toBe(403);
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const name = Date.now();
    for (const [i, ctx] of [a, b].entries()) {
      const r = await ctx.request.post("/api/auth/register", {
        headers: { Origin: "http://localhost:3000" },
        data: {
          name: "API Test",
          email: `api.${name}.${i}@tests.example`,
          password: "Browser-Lyno-2026!",
          company: `API Test ${i}`,
        },
      });
      expect(r.status()).toBe(200);
    }
    const stateA = await (await a.request.get("/api/state")).json();
    const stateB = await (await b.request.get("/api/state")).json();
    expect(
      (await b.request.get(`/api/articles/${stateA.articles[0].id}`)).status(),
    ).toBe(404);
    const write = await b.request.post("/api/workflows", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        templateId: stateA.templates[0].id,
        name: "IDOR-Versuch",
        formData: { kunde: "Fremd" },
      },
    });
    expect(write.status()).toBe(404);
    const switchAttempt = await b.request.post("/api/company/switch", {
      headers: { Origin: "http://localhost:3000" },
      data: { id: stateA.organization.id },
    });
    expect(switchAttempt.status()).toBe(404);
    expect(stateA.organization.id).not.toBe(stateB.organization.id);
  } finally {
    await a.close();
    await b.close();
  }
});
test("Beispiel-Arbeitsraum: Seiten, Dark Mode, Screenshots und kein horizontales Scrollen", async ({
  page,
}, testInfo) => {
  await page.goto("/anmelden");
  await page
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill("lea@lyno.example");
  await page.getByLabel("Passwort", { exact: true }).fill("Lyno-Demo-2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: /Guten Tag, Lea/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/app-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  for (const path of [
    "flow",
    "academy",
    "learning",
    "assist",
    "insights",
    "team",
    "audit",
    "settings",
    "notifications",
  ]) {
    await page.goto(`/app/${path}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Dunklen Modus aktivieren" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/app");
  const darkA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(darkA11y.violations).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/app-dark-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Hellen Modus aktivieren" }).click();
});

test("Vorlageneditor und Rollen: Formular, Bedingungen, Einladung und verbotene Aktionen", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${testInfo.project.name}.${Date.now()}`;
  const email = `editor.${suffix}@tests.example`;
  const password = "Editor-Lyno-2026!";
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3000" },
    data: { name: "Editor Test", email, password, company: "Editor Testfirma" },
  });
  expect(response.status()).toBe(200);
  await page.goto("/app/flow");
  await page
    .getByRole("button", { name: "Vorlage erstellen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name der Vorlage").fill("Bedingte Übergabe");
  await dialog.getByLabel("Aufgabe / Titel").fill("Übergabe vorbereiten");
  await dialog.getByRole("button", { name: "Feld hinzufügen" }).click();
  await dialog.getByLabel("Bezeichnung").fill("Zugang erforderlich");
  await dialog.getByLabel("Feldschlüssel").fill("zugang");
  await dialog.getByLabel("Typ", { exact: true }).selectOption("checkbox");
  await dialog.getByRole("button", { name: "Schritt hinzufügen" }).click();
  await dialog.getByLabel("Aufgabe / Titel").nth(1).fill("Zugang freigeben");
  await dialog.getByLabel("Schritttyp").nth(1).selectOption("approval");
  await dialog
    .getByLabel("Nur ausführen, wenn …")
    .nth(1)
    .selectOption("zugang");
  await dialog.getByRole("button", { name: "Vorlage speichern" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /^Vorlagen/ }).click();
  const template = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Bedingte Übergabe" }) });
  await template.getByRole("button", { name: "Ablauf starten" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name des Ablaufs")
    .fill("Freigabe prüfen");
  await page.getByRole("dialog").getByLabel("Zugang erforderlich").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ablauf starten" })
    .click();
  await page.getByRole("button", { name: "Abschließen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Freigeben", exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const task = state.tasks.find(
    (t: { title: string }) => t.title === "Zugang freigeben",
  );
  await page.goto("/app/team");
  await page.getByRole("button", { name: "Person einladen" }).click();
  const recipient = `member.${suffix}@tests.example`;
  await page.getByRole("dialog").getByLabel("E-Mail-Adresse").fill(recipient);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Einladung vorbereiten" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  let invitation = "";
  for (const f of (await readdir(".local/mail")).sort().reverse()) {
    const m = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
    if (m.to === recipient && m.subject.includes("Einladung")) {
      invitation = new URL(m.text).searchParams.get("token")!;
      break;
    }
  }
  const member = await browser.newContext();
  try {
    expect(
      (
        await member.request.post("/api/auth/register", {
          headers: { Origin: "http://localhost:3000" },
          data: {
            name: "Mitglied Test",
            email: recipient,
            password,
            company: "Mitglied Eigene Firma",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await member.request.post("/api/auth/verify", {
          headers: { Origin: "http://localhost:3000" },
          data: { token: await verifyToken(recipient) },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await member.request.post("/api/invitations/accept", {
          headers: { Origin: "http://localhost:3000" },
          data: { token: invitation },
        })
      ).status(),
    ).toBe(200);
    const memberState = await (await member.request.get("/api/state")).json();
    expect(memberState.me.role).toBe("member");
    expect(memberState.organization.id).toBe(state.organization.id);
    expect(
      (
        await member.request.patch(`/api/tasks/${task.id}`, {
          headers: { Origin: "http://localhost:3000" },
          data: { action: "complete" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await member.request.patch(`/api/members/${memberState.me.id}`, {
          headers: { Origin: "http://localhost:3000" },
          data: { role: "owner" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await member.request.post("/api/billing", {
          headers: { Origin: "http://localhost:3000" },
          data: { action: "subscribe", plan: "business" },
        })
      ).status(),
    ).toBe(403);
    expect((await member.request.get("/api/export")).status()).toBe(403);
  } finally {
    await member.close();
  }
});

test("Bestätigte Löschung einer Testfirma und erneutes Firmen-Onboarding", async ({
  page,
}, testInfo) => {
  const email = `lifecycle.${testInfo.project.name}.${Date.now()}@tests.example`;
  const password = "Lifecycle-Lyno-2026!";
  expect(
    (
      await page.request.post("/api/auth/register", {
        headers: { Origin: "http://localhost:3000" },
        data: {
          name: "Lifecycle Test",
          email,
          password,
          company: "Löschbare Testfirma",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Daten & Zugriff" }).click();
  await page
    .getByRole("button", { name: "Unternehmenslöschung vorbereiten" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ihr Passwort").fill(password);
  await dialog
    .getByLabel("Zur Bestätigung eingeben: Löschbare Testfirma")
    .fill("Löschbare Testfirma");
  await dialog.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/einrichten$/);
  await page
    .getByLabel("Unternehmen", { exact: true })
    .fill("Neuer Testarbeitsraum");
  await page.getByRole("button", { name: "Unternehmen erstellen" }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(
    (await (await page.request.get("/api/state")).json()).organization.name,
  ).toBe("Neuer Testarbeitsraum");
});
