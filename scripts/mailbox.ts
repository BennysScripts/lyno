import { readdir, readFile } from "node:fs/promises";
const recipient = process.argv[2]?.trim().toLowerCase();
if (!recipient || !recipient.includes("@")) {
  console.error("Verwendung: npm run mailbox -- ihre@email.de");
  process.exitCode = 1;
} else {
  let count = 0;
  for (const file of (await readdir(".local/mail").catch(() => []))
    .sort()
    .reverse()) {
    const message = JSON.parse(await readFile(`.local/mail/${file}`, "utf8"));
    if (message.to === recipient) {
      count++;
      console.log(
        `${message.createdAt} · ${message.subject}\n${message.text}\n`,
      );
    }
  }
  if (!count) console.log("Keine lokalen Nachrichten für diesen Empfänger.");
}
