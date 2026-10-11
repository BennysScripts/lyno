import path from "node:path";
import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
const root = process.cwd();
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
process.env.NODE_ENV = "production";
process.env.HOSTNAME = process.env.LYNO_BIND_HOST || "127.0.0.1";
process.env.LYNO_DATA_DIR =
  process.env.LYNO_DATA_DIR || path.join(root, ".local");
const server = path.join(root, ".next", "standalone", "server.js");
await access(server);
await import(pathToFileURL(server).href);
