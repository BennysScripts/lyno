import { Pool } from "pg";
import { z } from "zod";
// Operator-only administration: migration credentials, never exposed in the tenant API.
const command = process.argv[2] || "show";
const db = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const c = await db.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(815410)");
  if (command === "configure") {
    const d = z
      .object({
        capacity: z.coerce.number().int().min(0).max(100000),
        percent: z.coerce.number().int().min(1).max(90),
        months: z.coerce.number().int().min(1).max(24),
        enabled: z.enum(["true", "false"]),
      })
      .parse({
        capacity: process.argv[3],
        percent: process.argv[4],
        months: process.argv[5],
        enabled: process.argv[6],
      });
    const used = (
      await c.query(
        "SELECT (SELECT count(*) FROM paying_customers WHERE launch_discount)+(SELECT count(*) FROM launch_reservations WHERE redeemed_at IS NULL AND expires_at>now()) AS n",
      )
    ).rows[0].n;
    if (d.capacity < Number(used))
      throw new Error(
        "Kapazität darf eingelöste und reservierte Plätze nicht unterschreiten.",
      );
    await c.query(
      "UPDATE launch_campaign SET capacity=$1,percent=$2,months=$3,enabled=$4,updated_at=now() WHERE id=true",
      [d.capacity, d.percent, d.months, d.enabled === "true"],
    );
  } else if (command !== "show")
    throw new Error(
      "Aufruf: npm run campaign -- show | configure <Kapazität> <Prozent> <Monate> <true|false>",
    );
  console.log((await c.query("SELECT * FROM launch_campaign")).rows[0]);
  await c.query("COMMIT");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await db.end();
}
