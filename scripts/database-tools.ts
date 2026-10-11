import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Local Docker tools only. No credentials in arguments, no shell interpolation,
// no DROP/--clean. Restore always creates a new database before importing.
const container = process.env.LYNO_DB_CONTAINER;
if (container && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(container))
  throw new Error("Ungültiger lokaler Containername.");
const dockerArgs = container
  ? ["exec", "-i", container]
  : ["compose", "exec", "-T", "db"];

async function docker(args: string[], input?: Readable, output?: Writable) {
  const child = spawn("docker", [...dockerArgs, ...args], {
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
  });
  const done = new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("Docker nicht erreichbar.")));
    child.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${args[0]} fehlgeschlagen (Status ${code}). Docker-Zustand, Berechtigungen und Zielname prüfen. Vorhandene Datenbanken wurden nicht überschrieben.`,
          ),
        );
    });
  });
  const transferOut = output
    ? pipeline(child.stdout, output)
    : (child.stdout.resume(), Promise.resolve());
  const transferIn = input
    ? pipeline(input, child.stdin)
    : (child.stdin.end(), Promise.resolve());
  try {
    await Promise.all([done, transferOut, transferIn]);
  } catch (error) {
    child.kill();
    await Promise.allSettled([done, transferOut, transferIn]);
    throw error;
  }
}

async function checksum(file: string) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

async function backup(destination?: string) {
  const file = path.resolve(
    destination ||
      `.local/backups/lyno-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`,
  );
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  // Exclusive creation prevents overwriting a previous backup, including symlinks.
  const metadata = await open(`${file}.json`, "wx", 0o600);
  try {
    const stream = createWriteStream(file, { flags: "wx", mode: 0o600 });
    await docker(
      ["pg_dump", "--username=lyno", "--dbname=lyno", "--format=custom"],
      undefined,
      stream,
    );
    const sha256 = await checksum(file);
    await metadata.writeFile(
      JSON.stringify(
        {
          format: "lyno-local-postgresql-backup-v1",
          createdAt: new Date().toISOString(),
          database: "lyno",
          sha256,
        },
        null,
        2,
      ) + "\n",
    );
    await metadata.sync();
    console.log(`Lokale Sicherung: ${file}\nSHA-256: ${sha256}`);
  } finally {
    await metadata.close();
  }
}

async function restore(source?: string, database?: string) {
  if (!source || !database || !/^lyno_restore_[a-z0-9_]{1,40}$/.test(database))
    throw new Error(
      "Aufruf: npm run db:restore -- <Datei.dump> <lyno_restore_eindeutiger_name>",
    );
  const file = path.resolve(source);
  const metadata = JSON.parse(await readFile(`${file}.json`, "utf8"));
  if (
    metadata.format !== "lyno-local-postgresql-backup-v1" ||
    typeof metadata.sha256 !== "string" ||
    metadata.sha256 !== (await checksum(file))
  )
    throw new Error(
      "Sicherungsdatei ist unvollständig oder Prüfsumme ungültig.",
    );
  // PostgreSQL refuses CREATE DATABASE if this name exists. Never restore into
  // the application database or automatically delete a failed restore target.
  await docker([
    "createdb",
    "--username=lyno",
    "--maintenance-db=lyno",
    database,
  ]);
  await docker(
    [
      "pg_restore",
      "--username=lyno",
      `--dbname=${database}`,
      "--exit-on-error",
      "--single-transaction",
    ],
    createReadStream(file),
  );
  console.log(
    `Sicherung in neuer Prüfdatenbank ${database} wiederhergestellt.`,
  );
  await writeFile(
    `${file}.${database}.verified.json`,
    JSON.stringify(
      {
        database,
        restoredAt: new Date().toISOString(),
        sha256: metadata.sha256,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
}

try {
  const [action, file, database] = process.argv.slice(2);
  if (action === "backup") await backup(file);
  else if (action === "restore") await restore(file, database);
  else throw new Error("Aktion muss backup oder restore sein.");
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Datenbankwerkzeug fehlgeschlagen.",
  );
  process.exitCode = 1;
}
