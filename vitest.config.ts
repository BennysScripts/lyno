import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: ".env", quiet: true });
if (process.env.LYNO_ISOLATED_TEST !== "1")
  throw new Error(
    "Bitte npm test verwenden: Der Wrapper isoliert Datenbank, Postfach und externe Dienste.",
  );
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
