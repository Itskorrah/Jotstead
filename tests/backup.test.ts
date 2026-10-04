import { it, expect } from "vitest";
import { createStore } from "../src/lib/store";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
it("restores an independent SQLite snapshot and uploaded bytes into fresh storage", () => {
  const dir = mkdtempSync(join(tmpdir(), "jotstead-backup-"));
  const s = createStore(join(dir, "original.sqlite"));
  const first = s.read();
  first.data.name = "Restorable workspace";
  s.save(first.data, first.revision, "backup-write");
  mkdirSync(join(dir, "uploads"));
  writeFileSync(join(dir, "uploads", "test-file"), "saved attachment");
  s.backup(join(dir, "snapshot.sqlite"));
  const fresh = join(dir, "fresh");
  mkdirSync(fresh);
  cpSync(join(dir, "snapshot.sqlite"), join(fresh, "workspace.sqlite"));
  cpSync(join(dir, "uploads"), join(fresh, "uploads"), { recursive: true });
  const restored = createStore(join(fresh, "workspace.sqlite"));
  expect(restored.read().data.name).toBe("Restorable workspace");
  expect(readFileSync(join(fresh, "uploads", "test-file"), "utf8")).toBe(
    "saved attachment",
  );
  s.close();
  restored.close();
});
