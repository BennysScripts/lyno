import { runJobs } from "../src/lib/jobs";
import { deliverMail } from "../src/lib/mail";
import { pool } from "../src/lib/db";
import { runBillingJobs } from "../src/lib/billing-operations";
try {
  console.log({
    ...(await runJobs()),
    mail: await deliverMail(),
    billing: await runBillingJobs(),
  });
} finally {
  await pool.end();
}
