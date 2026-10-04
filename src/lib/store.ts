import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  validateWorkspace,
  type Workspace,
  type Snapshot,
  type Page,
} from "./model";
import { createSeed } from "./seed";
export class ConflictError extends Error {
  constructor() {
    super("Save conflict: the workspace changed on another device");
    this.name = "ConflictError";
  }
}
export function isConflictError(error: unknown): error is ConflictError {
  return (
    error instanceof ConflictError ||
    (error instanceof Error &&
      (error.name === "ConflictError" ||
        error.message ===
          "Save conflict: the workspace changed on another device"))
  );
}
export function createStore(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS history_page ON history(page_id,id); CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);",
  );
  const read = (): Snapshot => {
    let row = db
      .prepare("SELECT revision,body FROM workspace WHERE id=1")
      .get() as { revision: number; body: string } | undefined;
    if (!row) {
      const seed = createSeed();
      db.prepare("INSERT OR IGNORE INTO workspace VALUES (1,0,?)").run(
        JSON.stringify(seed),
      );
      row = db
        .prepare("SELECT revision,body FROM workspace WHERE id=1")
        .get() as { revision: number; body: string };
    }
    return { revision: row.revision, data: JSON.parse(row.body) };
  };
  const save = (
    data: Workspace,
    baseRevision: number,
    mutationId: string,
  ): Snapshot => {
    const validated = validateWorkspace(data);
    db.exec("BEGIN IMMEDIATE");
    try {
      const duplicate = db
        .prepare("SELECT revision FROM mutations WHERE id=?")
        .get(mutationId);
      if (duplicate) {
        const current = read();
        db.exec("COMMIT");
        return current;
      }
      const current = read();
      if (current.revision !== baseRevision) throw new ConflictError();
      const revision = current.revision + 1;
      const previous = new Map(current.data.pages.map((p) => [p.id, p]));
      for (const page of validated.pages) {
        const old = previous.get(page.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(page)) {
          if (old)
            db.prepare(
              "INSERT INTO history (page_id,revision,body,created_at) VALUES (?,?,?,?)",
            ).run(
              page.id,
              current.revision,
              JSON.stringify(old),
              new Date().toISOString(),
            );
          db.prepare(
            "INSERT INTO history (page_id,revision,body,created_at) VALUES (?,?,?,?)",
          ).run(
            page.id,
            revision,
            JSON.stringify(page),
            new Date().toISOString(),
          );
        }
      }
      db.prepare("UPDATE workspace SET revision=?,body=? WHERE id=1").run(
        revision,
        JSON.stringify(validated),
      );
      db.prepare("INSERT INTO mutations VALUES (?,?)").run(
        mutationId,
        revision,
      );
      db.prepare("DELETE FROM mutations WHERE revision<?").run(revision - 1000);
      db.exec("COMMIT");
      return { revision, data: validated };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const history = (pageId: string) =>
    db
      .prepare(
        "SELECT id,revision,created_at,body FROM history WHERE page_id=? ORDER BY id DESC LIMIT 100",
      )
      .all(pageId)
      .map((r) => ({
        id: Number(r.id),
        revision: Number(r.revision),
        createdAt: String(r.created_at),
        page: JSON.parse(String(r.body)) as Page,
      }));
  const throttle = (key: string): boolean => {
    const n = Date.now();
    const row = db
      .prepare("SELECT count,expires FROM login_attempts WHERE id=?")
      .get(key) as { count: number; expires: number } | undefined;
    db.prepare("DELETE FROM login_attempts WHERE expires<?").run(n);
    if (row && row.expires > n && row.count >= 10) return false;
    db.prepare(
      "INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires>? THEN count+1 ELSE 1 END,expires=CASE WHEN expires>? THEN expires ELSE excluded.expires END",
    ).run(key, n + 15 * 60 * 1000, n, n);
    return true;
  };
  return {
    read,
    save,
    history,
    throttle,
    close: () => db.close(),
    backup: (target: string) => {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.prepare("VACUUM INTO ?").run(target);
    },
  };
}
const globalStore = globalThis as unknown as {
  jotsteadStore?: ReturnType<typeof createStore>;
};
export const dataDir = () =>
  resolve(/*turbopackIgnore: true*/ process.env.JOTSTEAD_DATA_DIR || "data");
export function getStore() {
  return (globalStore.jotsteadStore ??= createStore(
    resolve(dataDir(), "workspace.sqlite"),
  ));
}
