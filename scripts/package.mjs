import { cp, readdir, rm, access } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const output = path.join(root, ".next", "standalone");
await access(path.join(output, "server.js"));
// Next copies .env into standalone by default. Release artifacts must contain
// neither runtime secrets nor the local token mailbox. Only generated copies
// inside .next/standalone are removed; source configuration and data stay intact.
for (const entry of await readdir(output)) {
  if (entry.startsWith(".env") || entry === ".local")
    await rm(path.join(output, entry), { recursive: true, force: true });
}
await cp(
  path.join(root, ".next", "static"),
  path.join(output, ".next", "static"),
  { recursive: true },
);
await cp(path.join(root, "public"), path.join(output, "public"), {
  recursive: true,
});
console.log(
  "Standalone-Paket vorbereitet: statische Assets enthalten, keine .env oder lokale Nachrichten.",
);
