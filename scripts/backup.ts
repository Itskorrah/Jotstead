import { resolve, join } from "node:path";
import { mkdir, cp, writeFile, access } from "node:fs/promises";
import { createStore, dataDir } from "../src/lib/store";
const source = dataDir();
const target = resolve(
  process.argv[2] ||
    join("backups", new Date().toISOString().replace(/[:.]/g, "-")),
);
if (target === source || target.startsWith(source + "/"))
  throw new Error("Backup target must be outside the data directory.");
try {
  await access(target);
  throw new Error("Backup target already exists; choose a new directory.");
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
await mkdir(target, { recursive: true });
const s = createStore(join(source, "workspace.sqlite"));
s.backup(join(target, "workspace.sqlite"));
s.close();
try {
  await cp(join(source, "uploads"), join(target, "uploads"), {
    recursive: true,
    errorOnExist: true,
  });
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
await writeFile(
  join(target, "backup.json"),
  JSON.stringify(
    {
      version: 1,
      createdAt: new Date().toISOString(),
      contents: ["workspace.sqlite", "uploads"],
    },
    null,
    2,
  ),
);
console.log(`Backup saved to ${target}`);
