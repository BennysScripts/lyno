import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.create.mockReturnValue({
      sendMail: mocks.send,
      close: mocks.close,
    }),
  },
}));
import { sendMail, deliverMail } from "../src/lib/mail";
import { query, pool } from "../src/lib/db";
const keys = [
  "MAIL_MODE",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM",
  "MAIL_ENCRYPTION_KEY",
] as const;
const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const ids: string[] = [];
beforeAll(() => {
  Object.assign(process.env, {
    MAIL_MODE: "smtp",
    SMTP_HOST: "smtp.tests.example",
    SMTP_PORT: "587",
    SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture-no-network",
    MAIL_FROM: "noreply@tests.example",
    MAIL_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
  });
});
afterAll(async () => {
  await query("DELETE FROM mail_outbox WHERE id=ANY($1::uuid[])", [ids]);
  for (const k of keys) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
  await pool.end();
});
describe("Verschlüsselte SMTP-Outbox (Transport gemockt, keine externen Nachrichten)", () => {
  it("persistiert verschlüsselt und liefert nur über TLS mit stabiler Message-ID", async () => {
    const message = await sendMail(
      "recipient@tests.example",
      "Testbestätigung",
      "https://localhost/confirm?token=sensitive-fixture",
    );
    ids.push(message.id);
    const [queued] = await query("SELECT * FROM mail_outbox WHERE id=$1", [
      message.id,
    ]);
    expect(queued.payload).not.toContain("sensitive-fixture");
    expect(queued.payload).not.toContain("recipient");
    mocks.send.mockResolvedValueOnce({ messageId: "fixture" });
    expect(await deliverMail([message.id])).toEqual({ sent: 1, failed: 0 });
    expect(mocks.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requireTLS: true,
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      }),
    );
    expect(mocks.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: "recipient@tests.example",
        text: "https://localhost/confirm?token=sensitive-fixture",
        messageId: `<${message.id}@tests.example>`,
      }),
    );
    const [sent] = await query("SELECT * FROM mail_outbox WHERE id=$1", [
      message.id,
    ]);
    expect(sent.status).toBe("sent");
    expect(sent.payload).toBe("");
    expect(await deliverMail([message.id])).toEqual({ sent: 0, failed: 0 });
  });
  it("plant bei Transportfehlern einen begrenzten Wiederholungsversuch ohne sensible Logs", async () => {
    const message = await sendMail(
      "retry@tests.example",
      "Retry",
      "Unkritische Testnachricht",
    );
    ids.push(message.id);
    mocks.send.mockRejectedValueOnce(new Error("mocked SMTP unavailable"));
    expect(await deliverMail([message.id])).toEqual({ sent: 0, failed: 1 });
    const [r] = await query("SELECT * FROM mail_outbox WHERE id=$1", [
      message.id,
    ]);
    expect(r.attempts).toBe(1);
    expect(r.status).toBe("queued");
    expect(r.last_error).toBe("delivery_failed");
    expect(new Date(r.available_at).getTime()).toBeGreaterThan(Date.now());
    await query(
      "UPDATE mail_outbox SET attempts=4,available_at=now() WHERE id=$1",
      [message.id],
    );
    mocks.send.mockRejectedValueOnce(new Error("still unavailable"));
    await deliverMail([message.id]);
    expect(
      (
        await query("SELECT status FROM mail_outbox WHERE id=$1", [message.id])
      )[0].status,
    ).toBe("failed");
  });
  it("bricht ohne Schlüssel oder gültige sichere SMTP-Konfiguration ab", async () => {
    const key = process.env.MAIL_ENCRYPTION_KEY;
    delete process.env.MAIL_ENCRYPTION_KEY;
    await expect(
      sendMail("x@tests.example", "No key", "Text"),
    ).rejects.toMatchObject({ status: 503 });
    process.env.MAIL_ENCRYPTION_KEY = key;
    process.env.SMTP_PORT = "25";
    await expect(
      sendMail("x@tests.example", "No TLS", "Text"),
    ).rejects.toMatchObject({ status: 503 });
    process.env.SMTP_PORT = "587";
  });
});
