import { it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function launch(
  overrides: Record<string, string | undefined> = {},
  args: string[] = [],
) {
  const root = mkdtempSync(join(tmpdir(), "jotstead-launch-"));
  for (const folder of [
    "scripts",
    "public",
    ".next/static",
    ".next/standalone",
  ])
    mkdirSync(join(root, folder), { recursive: true });
  cpSync(resolve("scripts/start.mjs"), join(root, "scripts/start.mjs"));
  if (existsSync(resolve("scripts/launch-mode.mjs")))
    cpSync(
      resolve("scripts/launch-mode.mjs"),
      join(root, "scripts/launch-mode.mjs"),
    );
  writeFileSync(
    join(root, ".next/standalone/server.js"),
    "console.log(JSON.stringify({host:process.env.HOSTNAME,local:process.env.JOTSTEAD_LOCAL_ONLY||'0'}))",
  );
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/start.mjs"), ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        JOTSTEAD_PASSWORD: "",
        JOTSTEAD_PUBLIC_URL: "",
        JOTSTEAD_BIND_HOST: "",
        JOTSTEAD_LOCAL_ONLY: "",
        ...overrides,
      },
    },
  );
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout.trim());
}
it("opens the workspace directly by default on this computer", () =>
  expect(launch()).toEqual({ host: "127.0.0.1", local: "1" }));
it.each([
  { JOTSTEAD_PASSWORD: "protected" },
  { JOTSTEAD_PUBLIC_URL: "https://notes.example" },
  { JOTSTEAD_BIND_HOST: "0.0.0.0", JOTSTEAD_LOCAL_ONLY: "1" },
])(
  "does not enable direct local access for protected or remote configuration %j",
  (config) => expect(launch(config).local).toBe("0"),
);
it("supports explicitly protected local launch", () =>
  expect(launch({}, ["--protected"]).local).toBe("0"));
