// Run Next's standalone artifact with static assets and persistent data at the project root.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}
const server = join(root, ".next/standalone/server.js");
if (!existsSync(server)) throw new Error("Build Jotstead first: pnpm build");
cpSync(join(root, "public"), join(root, ".next/standalone/public"), {
  recursive: true,
});
mkdirSync(join(root, ".next/standalone/.next"), { recursive: true });
cpSync(
  join(root, ".next/static"),
  join(root, ".next/standalone/.next/static"),
  { recursive: true },
);
process.env.JOTSTEAD_DATA_DIR = resolve(
  root,
  process.env.JOTSTEAD_DATA_DIR || "data",
);
const localPreview = process.argv.includes("--local");
process.env.HOSTNAME = localPreview
  ? "127.0.0.1"
  : process.env.JOTSTEAD_BIND_HOST || "127.0.0.1";
if (localPreview) process.env.JOTSTEAD_LOCAL_ONLY = "1";
process.env.NODE_ENV = "production";
process.env.PORT ||= "3000";
await import(pathToFileURL(server).href);
