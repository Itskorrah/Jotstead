/** Offline, independently verifiable Jotstead workspace backup and safe restore. */
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

type Entry = { path: string; bytes: number; sha256: string };
type Manifest = { format: "jotstead-backup"; version: 2; createdAt: string; revision: number; files: Entry[] };
const SQLITE = "workspace.sqlite";
const MANIFEST = "backup.json";
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const inside = (parent: string, child: string) => {
  const r = relative(resolve(parent), resolve(child));
  return r === "" || (r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r));
};
const safePath = (path: string) => path === SQLITE || /^uploads\/[a-zA-Z0-9_-]+(?:\.json)?$/.test(path);

async function regularFile(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Not a regular file: ${path}`);
  return info;
}
async function uploadNames(root: string): Promise<string[]> {
  const uploads = join(root, "uploads");
  let list;
  try { list = await readdir(uploads, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const names = list.map((item) => `uploads/${item.name}`).sort();
  for (const name of names) {
    if (!safePath(name)) throw new Error(`Unexpected upload filename: ${name}`);
    await regularFile(join(root, name)); // Reject links, directories and special files.
  }
  return names;
}
async function fileEntry(root: string, path: string): Promise<Entry> {
  await regularFile(join(root, path));
  const bytes = await readFile(join(root, path));
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
}
async function snapshotInfo(file: string) {
  await regularFile(file);
  const db = new DatabaseSync(file);
  try {
    const check = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    if (check.length !== 1 || check[0].integrity_check !== "ok") throw new Error("SQLite integrity check failed");
    const row = db.prepare("SELECT revision FROM workspace WHERE id=1").get() as { revision: number } | undefined;
    if (!row || !Number.isSafeInteger(row.revision) || row.revision < 0)
      throw new Error("Missing or invalid workspace revision");
    db.prepare("SELECT count(*) AS total FROM history").get();
    return row.revision;
  } finally { db.close(); }
}
function checkManifest(input: unknown): asserts input is Manifest {
  if (!input || typeof input !== "object") throw new Error("Invalid backup manifest");
  const m = input as Manifest;
  if (m.format !== "jotstead-backup" || m.version !== 2 || !Number.isSafeInteger(m.revision) || m.revision < 0 || !Array.isArray(m.files) || typeof m.createdAt !== "string")
    throw new Error("Unsupported backup manifest");
  if (!m.files.length || m.files[0]?.path !== SQLITE) throw new Error("Backup is missing workspace.sqlite");
  const paths = new Set<string>();
  for (const e of m.files) {
    if (!e || typeof e.path !== "string" || !safePath(e.path) || paths.has(e.path) || !Number.isSafeInteger(e.bytes) || e.bytes < 0 || !/^[a-f0-9]{64}$/.test(e.sha256))
      throw new Error("Invalid or duplicate file entry in backup manifest");
    paths.add(e.path);
  }
}
export async function verifyBackup(dir: string): Promise<Manifest> {
  const root = resolve(dir);
  await regularFile(join(root, MANIFEST));
  const manifest: unknown = JSON.parse(await readFile(join(root, MANIFEST), "utf8"));
  checkManifest(manifest);
  const actual = [SQLITE, ...(await uploadNames(root))];
  if (actual.length !== manifest.files.length || actual.some((path, index) => path !== manifest.files[index].path))
    throw new Error("Backup file inventory differs from manifest");
  for (const e of manifest.files) {
    const current = await fileEntry(root, e.path);
    if (current.bytes !== e.bytes || current.sha256 !== e.sha256) throw new Error(`Backup checksum mismatch: ${e.path}`);
  }
  if ((await snapshotInfo(join(root, SQLITE))) !== manifest.revision) throw new Error("Backup revision mismatch");
  return manifest;
}
export async function createBackup(sourceDir: string, targetDir: string): Promise<Manifest> {
  const source = resolve(sourceDir), target = resolve(targetDir);
  if (inside(source, target) || source === target) throw new Error("Backup must be outside the live data directory");
  const parent = dirname(target);
  if (inside(source, parent)) throw new Error("Backup parent must be outside live data");
  await regularFile(join(source, SQLITE)); // Never create a new, empty workspace by accident.
  try { await lstat(target); throw new Error("Backup destination already exists"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  await mkdir(parent, { recursive: true });
  const staging = join(parent, `.${basename(target)}.partial-${randomUUID()}`);
  await mkdir(staging, { mode: 0o700 });
  try {
    const live = new DatabaseSync(join(source, SQLITE));
    try {
      live.prepare("VACUUM INTO ?").run(join(staging, SQLITE));
    } finally { live.close(); }
    const revision = await snapshotInfo(join(staging, SQLITE));
    const names = await uploadNames(source);
    if (names.length) await mkdir(join(staging, "uploads"));
    for (const name of names) {
      await regularFile(join(source, name));
      await copyFile(join(source, name), join(staging, name), constants.COPYFILE_EXCL);
    }
    const files = [SQLITE, ...names];
    const entries = await Promise.all(files.map((path) => fileEntry(staging, path)));
    // Fail closed if a live save or attachment write occurred while copying.
    if ((await snapshotInfo(join(source, SQLITE))) !== revision) throw new Error("Workspace changed during backup; pause writes and retry");
    const liveUploads = await uploadNames(source);
    if (names.join("\0") !== liveUploads.join("\0")) throw new Error("Uploads changed during backup; pause writes and retry");
    for (const name of names) {
      const copied = entries.find((e) => e.path === name)!;
      const liveEntry = await fileEntry(source, name);
      if (liveEntry.sha256 !== copied.sha256 || liveEntry.bytes !== copied.bytes)
        throw new Error("An upload changed during backup; pause writes and retry");
    }
    const manifest: Manifest = { format: "jotstead-backup", version: 2, createdAt: new Date().toISOString(), revision, files: entries };
    await writeFile(join(staging, MANIFEST), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await verifyBackup(staging);
    // mkdir+rename on one filesystem: consumers only see a complete verified backup.
    await rename(staging, target);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
export async function restoreBackup(backupDir: string, destinationDir: string, dryRun = false): Promise<Manifest> {
  const backup = resolve(backupDir), dest = resolve(destinationDir);
  if (inside(backup, dest) || inside(dest, backup)) throw new Error("Restore destination must be separate from backup");
  const manifest = await verifyBackup(backup);
  if (dryRun) return manifest;
  try { await lstat(dest); throw new Error("Restore destination already exists: use a fresh path"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  await mkdir(dirname(dest), { recursive: true });
  const staging = join(dirname(dest), `.${basename(dest)}.partial-${randomUUID()}`);
  await mkdir(staging, { mode: 0o700 });
  try {
    if (manifest.files.length > 1) await mkdir(join(staging, "uploads"));
    for (const entry of manifest.files)
      await copyFile(join(backup, entry.path), join(staging, entry.path), constants.COPYFILE_EXCL);
    await writeFile(join(staging, MANIFEST), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await verifyBackup(staging);
    await rename(staging, dest);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
function help(): never {
  throw new Error("Usage: pnpm backup [new-output-directory] | pnpm backup --verify <backup-dir> | pnpm backup --restore <backup-dir> <fresh-data-dir> [--dry-run]");
}
async function main(args: string[]) {
  if (args[0] === "--verify" && args.length === 2) {
    const result = await verifyBackup(args[1]);
    console.log(`Verified ${result.files.length} backup files at workspace revision ${result.revision}`);
  } else if (args[0] === "--restore" && (args.length === 3 || (args.length === 4 && args[3] === "--dry-run"))) {
    const result = await restoreBackup(args[1], args[2], args[3] === "--dry-run");
    console.log(`${args[3] === "--dry-run" ? "Verified dry-run" : "Restored into fresh directory"}: ${result.files.length} files; revision ${result.revision}`);
  } else if (args.length < 2 && args[0] !== "--verify" && args[0] !== "--restore") {
    const target = args[0] || join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
    const result = await createBackup(process.env.JOTSTEAD_DATA_DIR || "data", target);
    console.log(`Verified backup saved to ${resolve(target)} (${result.files.length} files; revision ${result.revision})`);
  } else help();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
