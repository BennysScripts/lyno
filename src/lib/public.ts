import { z } from "zod";
import { query } from "./db";
import {
  AppError,
  appUrl,
  emailSchema,
  hash,
  token,
  rateLimit,
} from "./security";
import { sendMail } from "./mail";
export async function joinWaitlist(input: unknown) {
  const d = z
    .object({
      email: emailSchema,
      company: z.string().trim().min(2).max(120),
      marketingConsent: z.boolean().default(false),
    })
    .parse(input);
  await rateLimit(`waitlist:${d.email}`, 3, 3600);
  const raw = token();
  const result = await query(
    "INSERT INTO waitlist(email,company,marketing_consent,token_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET company=excluded.company,marketing_consent=excluded.marketing_consent,token_hash=excluded.token_hash,confirmed_at=NULL,expires_at=now()+interval '2 days' RETURNING id",
    [d.email, d.company, d.marketingConsent, hash(raw)],
  );
  if (result.length)
    await sendMail(
      d.email,
      "LYNO: Beta-Anmeldung bestätigen",
      `${appUrl()}/bestaetigen?type=waitlist&token=${raw}`,
    );
  return {
    message:
      process.env.MAIL_MODE === "smtp"
        ? "Bitte bestätigen Sie Ihre Anmeldung über den E-Mail-Link. Ihre Nachricht ist für den Versand vorgemerkt."
        : "Bitte bestätigen Sie Ihre Anmeldung über den Link. Im lokalen Testbetrieb liegt die Nachricht im Dateipostfach; es wurde keine E-Mail versendet.",
  };
}
export async function confirmWaitlist(raw: string) {
  const r = await query(
    "UPDATE waitlist SET confirmed_at=now() WHERE token_hash=$1 AND expires_at>now() AND confirmed_at IS NULL RETURNING id",
    [hash(raw)],
  );
  if (!r.length)
    throw new AppError(
      400,
      "Dieser Bestätigungslink wurde bereits verwendet oder ist abgelaufen.",
    );
  return {
    message:
      "Ihre Beta-Anmeldung wurde bestätigt. Vielen Dank für Ihr Interesse an LYNO.",
  };
}
export async function contact(input: unknown) {
  const d = z
    .object({
      email: emailSchema,
      name: z.string().trim().min(2).max(100),
      message: z.string().trim().min(10).max(5000),
    })
    .parse(input);
  await rateLimit(`contact:${d.email}`, 3, 3600);
  await query(
    "INSERT INTO contact_requests(email,name,message) VALUES($1,$2,$3)",
    [d.email, d.name, d.message],
  );
  return {
    message:
      "Ihre Anfrage wurde lokal gespeichert. Diese Installation versendet keine Nachrichten an einen Vertrieb.",
  };
}
