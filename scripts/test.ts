import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const mode = process.argv[2];
if (mode !== "unit" && mode !== "e2e")
  throw new Error("Testmodus muss unit oder e2e sein.");

const adminUrl = new URL(
  process.env.MIGRATION_DATABASE_URL || "postgres://invalid",
);
const appUrl = new URL(process.env.DATABASE_URL || "postgres://invalid");
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (
  !localHosts.has(adminUrl.hostname) ||
  !localHosts.has(appUrl.hostname) ||
  adminUrl.host !== appUrl.host
)
  throw new Error(
    "Automatisierte Tests benötigen eine lokale PostgreSQL-Instanz mit übereinstimmenden Hosts/Ports in beiden Datenbank-URLs.",
  );
const name = `lyno_test_${randomUUID().replaceAll("-", "")}`;
const dataRoot = path.resolve(".local", "test-runs", name);
const admin = new Pool({ connectionString: adminUrl.href, max: 1 });
const testAdmin = new URL(adminUrl),
  testApp = new URL(appUrl);
testAdmin.pathname = `/${name}`;
testApp.pathname = `/${name}`;
const env = {
  ...process.env,
  MIGRATION_DATABASE_URL: testAdmin.href,
  DATABASE_URL: testApp.href,
  LYNO_ISOLATED_TEST: "1",
  LYNO_DATA_DIR: dataRoot,
  MAIL_MODE: "local",
  ASSIST_MODE: "test",
  BILLING_MODE: "test",
  OPENAI_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  NEXT_TELEMETRY_DISABLED: "1",
  ...(mode === "e2e"
    ? {
        APP_URL: "http://localhost:3000",
        LYNO_BIND_HOST: "127.0.0.1",
        PORT: "3000",
        ALLOW_INSECURE_LOCALHOST: "true",
      }
    : {}),
};
let child: ChildProcess | undefined;
let created = false;
let dataCreated = false;
let interrupted = false;
const stop = () => {
  interrupted = true;
  child?.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
async function run(args: string[]) {
  if (interrupted) return 130;
  return new Promise<number>((resolve, reject) => {
    child = spawn(process.execPath, args, {
      env,
      stdio: ["ignore", "inherit", "inherit"],
      shell: false,
    });
    child.once("error", reject);
    child.once("close", (code) => {
      child = undefined;
      resolve(code ?? 130);
    });
  });
}
try {
  await mkdir(path.dirname(dataRoot), { recursive: true, mode: 0o700 });
  await mkdir(dataRoot, { mode: 0o700 });
  dataCreated = true;
  // Name is generated internally; the command never targets the configured
  // application database. Role credentials are not changed by test migrations.
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  console.log(
    "Neue isolierte Testdatenbank angelegt; Anwendungsdaten bleiben unberührt.",
  );
  const migration = await run(["--import", "tsx", "scripts/migrate.ts"]);
  const seed =
    !migration && mode === "e2e"
      ? await run(["--import", "tsx", "scripts/seed.ts"])
      : 0;
  process.exitCode =
    migration ||
    seed ||
    (await run(
      mode === "e2e"
        ? [
            "node_modules/@playwright/test/cli.js",
            "test",
            ...process.argv.slice(3),
          ]
        : ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(3)],
    ));
} catch {
  console.error(
    "Testdatenbank oder Testprozess konnte nicht gestartet werden. Lokales PostgreSQL, vorherige Migration und administrative CREATEDB-Rechte prüfen.",
  );
  process.exitCode = 1;
} finally {
  if (created) {
    if (process.env.LYNO_KEEP_TEST_DATABASE === "true")
      console.log(`Prüfdatenbank zur Diagnose erhalten: ${name}`);
    else {
      // Only this invocation's successfully created random database can be
      // removed, including its own leftover test connections after a crash.
      try {
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        console.log("Eigene temporäre Testdatenbank entfernt.");
      } catch {
        console.error(
          `Temporäre Prüfdatenbank zur manuellen Diagnose erhalten: ${name}`,
        );
        process.exitCode = 1;
      }
    }
  }
  await admin.end();
  if (dataCreated && process.env.LYNO_KEEP_TEST_DATABASE !== "true")
    await rm(dataRoot, { recursive: true, force: true });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
