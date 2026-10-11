import { afterAll, beforeAll, expect, test } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "lyno-backup-test-"));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
function run(action: string, file: string, database?: string) {
  return spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/database-tools.ts",
      action,
      file,
      ...(database ? [database] : []),
    ],
    { encoding: "utf8", timeout: 10000 },
  );
}

test("Restore lehnt Anwendungsdatenbank und freie Zielnamen vor Docker-Aufruf ab", () => {
  for (const name of ["lyno", "postgres", "lyno_restore_a;DROP", "-option"])
    expect(
      run("restore", path.join(directory, "missing.dump"), name).stderr,
    ).toContain("lyno_restore_eindeutiger_name");
});

test("Bestehende Sicherung und Metadaten werden nicht überschrieben", async () => {
  const file = path.join(directory, "existing.dump");
  await writeFile(file, "existing backup");
  await writeFile(`${file}.json`, "existing metadata");
  const result = run("backup", file);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("EEXIST");
  expect(await readFile(file, "utf8")).toBe("existing backup");
  expect(await readFile(`${file}.json`, "utf8")).toBe("existing metadata");
});

test("Beschädigte Sicherung wird vor Datenbankanlage erkannt", async () => {
  const file = path.join(directory, "corrupt.dump");
  await writeFile(file, "damaged backup");
  await writeFile(
    `${file}.json`,
    JSON.stringify({
      format: "lyno-local-postgresql-backup-v1",
      sha256: createHash("sha256").update("original backup").digest("hex"),
    }),
  );
  const result = run("restore", file, "lyno_restore_corrupt_test");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Prüfsumme ungültig");
});
