import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { launchMode } from "./launch-mode.mjs";
const root = resolve(import.meta.dirname, "..");
for (const name of [".env.local", ".env"]) {
  const file = resolve(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
const args = process.argv.slice(2);
const mode = launchMode(process.env, args);
const child = spawn(
  process.execPath,
  [
    createRequire(import.meta.url).resolve("next/dist/bin/next"),
    "dev",
    "--hostname",
    mode.host,
    ...args.filter((arg) => !["--local", "--protected"].includes(arg)),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, JOTSTEAD_LOCAL_ONLY: mode.local },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
