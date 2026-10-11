import { runJobs } from "../src/lib/jobs";
import { deliverMail } from "../src/lib/mail";
import { pool } from "../src/lib/db";
try {
  console.log({ ...(await runJobs()), mail: await deliverMail() });
} finally {
  await pool.end();
}
