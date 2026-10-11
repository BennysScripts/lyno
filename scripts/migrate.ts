import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
const db = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const client = await db.connect();
try {
  await client.query("SELECT pg_advisory_lock(914052)");
  const isolatedTest = process.env.LYNO_ISOLATED_TEST === "1";
  const [appRole] = (
    await client.query(
      "SELECT oid,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='lyno_app'",
    )
  ).rows;
  if (
    appRole &&
    (appRole.rolsuper ||
      appRole.rolbypassrls ||
      appRole.rolcreatedb ||
      appRole.rolcreaterole ||
      (
        await client.query("SELECT 1 FROM pg_auth_members WHERE member=$1", [
          appRole.oid,
        ])
      ).rowCount)
  )
    throw new Error(
      "Die vorhandene Anwendungsrolle besitzt unzulässige Zusatzprivilegien. Rollenrechte vor Migration prüfen.",
    );
  if (
    isolatedTest &&
    (!appRole ||
      !/^\/lyno_test_[a-f0-9]{32}$/.test(
        new URL(process.env.MIGRATION_DATABASE_URL!).pathname,
      ))
  )
    throw new Error(
      "Isolierte Tests benötigen eine vorbereitete Anwendungsrolle und eine neue Prüfdatenbank.",
    );
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
          file,
        ])
      ).rowCount
    )
      continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(`migrations/${file}`, "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`Migration ${file} angewendet`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  const password = process.env.DB_APP_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("DB_APP_PASSWORD muss mindestens 12 Zeichen haben.");
  if (!appRole)
    await client.query(
      "CREATE ROLE lyno_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS",
    );
  // Identifier fixed; pg quote_literal handles password quoting, never log the generated SQL.
  if (!isolatedTest) {
    const escaped = (
      await client.query("SELECT quote_literal($1) AS p", [password])
    ).rows[0].p;
    await client.query(`ALTER ROLE lyno_app PASSWORD ${escaped}`);
  }
  await client.query(
    "GRANT USAGE ON SCHEMA public TO lyno_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO lyno_app; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lyno_app; REVOKE ALL ON schema_migrations FROM lyno_app; REVOKE UPDATE,DELETE ON audit_logs FROM lyno_app; REVOKE INSERT,UPDATE,DELETE ON launch_campaign FROM lyno_app",
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION lookup_invitation(text,text) TO lyno_app",
  );
  console.log(
    "Migrationen vollständig; eingeschränkte Anwendungsrolle bereit.",
  );
} finally {
  await client.query("SELECT pg_advisory_unlock(914052)");
  client.release();
  await db.end();
}
