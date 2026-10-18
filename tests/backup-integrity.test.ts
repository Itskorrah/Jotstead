import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync,
  symlinkSync, existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackup, restoreBackup, verifyBackup } from "../scripts/backup";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "jotstead-safe-backup-"));
  const live = join(root, "live");
  mkdirSync(join(live, "uploads"), { recursive: true });
  const db = new DatabaseSync(join(live, "workspace.sqlite"));
  db.exec("CREATE TABLE workspace (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE history (id INTEGER PRIMARY KEY, page_id TEXT, revision INTEGER, body TEXT, created_at TEXT); INSERT INTO workspace VALUES (1, 7, '{\"name\":\"Private notes\"}'); INSERT INTO history VALUES (1, 'home', 6, '{\"title\":\"Old note\"}', 'now');");
  db.close();
  const attachment = Buffer.from([0, 255, 4, 8, 42]);
  writeFileSync(join(live, "uploads", "asset-a"), attachment);
  writeFileSync(join(live, "uploads", "asset-a.json"), JSON.stringify({ name: "photo.jpg", size: 5 }));
  return { root, live, attachment };
}
describe("verified offline backups", () => {
  it("copies revisions, stored history and exact attachment bytes; verifies before fresh restore", async () => {
    const { root, live, attachment } = fixture();
    try {
      const backup = join(root, "backup"), restore = join(root, "restore");
      const manifest = await createBackup(live, backup);
      expect(manifest.revision).toBe(7);
      expect(manifest.files.map((f) => f.path)).toEqual([
        "workspace.sqlite", "uploads/asset-a", "uploads/asset-a.json",
      ]);
      expect((await verifyBackup(backup)).files).toHaveLength(3);
      await restoreBackup(backup, restore, true);
      expect(existsSync(restore)).toBe(false);
      await restoreBackup(backup, restore);
      expect(readFileSync(join(restore, "uploads", "asset-a"))).toEqual(attachment);
      const db = new DatabaseSync(join(restore, "workspace.sqlite"));
      try {
        expect(db.prepare("SELECT revision FROM workspace WHERE id=1").get()?.revision).toBe(7);
        expect(db.prepare("SELECT COUNT(*) AS total FROM history").get()?.total).toBe(1);
      } finally { db.close(); }
      await expect(restoreBackup(backup, restore)).rejects.toThrow("already exists");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("detects damaged attachment bytes and refuses restoration", async () => {
    const { root, live } = fixture();
    try {
      const backup = join(root, "backup");
      await createBackup(live, backup);
      writeFileSync(join(backup, "uploads", "asset-a"), Buffer.from("tampered"));
      await expect(verifyBackup(backup)).rejects.toThrow("checksum mismatch");
      await expect(restoreBackup(backup, join(root, "restore"))).rejects.toThrow("checksum mismatch");
      expect(existsSync(join(root, "restore"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects malicious manifest paths, nested destinations, symlink uploads and missing source data", async () => {
    const { root, live } = fixture();
    try {
      const backup = join(root, "backup");
      await createBackup(live, backup);
      const manifestPath = join(backup, "backup.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.files[1].path = "../private-key";
      writeFileSync(manifestPath, JSON.stringify(manifest));
      await expect(verifyBackup(backup)).rejects.toThrow("Invalid or duplicate");
      await expect(createBackup(live, join(live, "nested-backup"))).rejects.toThrow("outside");
      if (process.platform !== "win32") {
        symlinkSync(join(live, "uploads", "asset-a"), join(live, "uploads", "linked"));
        await expect(createBackup(live, join(root, "symlink-backup"))).rejects.toThrow("Not a regular file");
      }
      await expect(createBackup(join(root, "nonexistent"), join(root, "empty"))).rejects.toThrow();
      expect(existsSync(join(root, "empty"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
