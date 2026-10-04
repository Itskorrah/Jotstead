/** Server-only, separate from portable workspace exports and backups. */
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import { dataDir } from "./store";
export type Identity = { issuer: string; subject: string; clientId: string; email?: string; name?: string };
export type Credentials = { accessToken: string; refreshToken?: string; idToken?: string; scope: string; expiresAt: number; earliestRefreshAt?: number };
export type Attempt = { verifier: string; nonce: string; redirectUri: string; clientId: string; expiresAt: number; browserHash: string };
export type PluginPermissions = { enabled: boolean; writes: boolean; pageIds: string[] };
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function createVault(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keyPath = join(dir, "auth.key");
  try { writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  chmodSync(keyPath, 0o600);
  const key = readFileSync(keyPath);
  if (key.length !== 32) throw new Error("Invalid credential vault key");
  const file = join(dir, "auth.sqlite"), db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS vault (id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS attempts (state TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS lease (id INTEGER PRIMARY KEY, expires INTEGER NOT NULL);");
  const seal = (v: unknown) => { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv); return Buffer.concat([iv, cipher.update(JSON.stringify(v)), cipher.final(), cipher.getAuthTag()]).toString("base64"); };
  const unseal = <T>(v: string): T => { const b = Buffer.from(v, "base64"), c = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12)); c.setAuthTag(b.subarray(-16)); return JSON.parse(Buffer.concat([c.update(b.subarray(12, -16)), c.final()]).toString()); };
  const get = <T>(id: string): T | null => { const row = db.prepare("SELECT value FROM vault WHERE id=?").get(id); return row ? unseal<T>(String(row.value)) : null; };
  const put = (id: string, value: unknown) => db.prepare("INSERT INTO vault VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(id, seal(value));
  if (!get<string>("host")) { db.exec("BEGIN IMMEDIATE"); try { if (!get("host")) put("host", `urn:uuid:${randomUUID()}`); db.exec("COMMIT"); } catch(e) { db.exec("ROLLBACK"); throw e; } }
  const owner = () => get<Identity>("owner");
  const credentials = () => get<Credentials>("credentials");
  const credentialVersion = () => get<number>("credential-version") || 0;
  const sameOwner = (a: Identity, b: Identity) => a.issuer === b.issuer && a.subject === b.subject;
  return {
    hostId: () => get<string>("host")!, owner, credentials, credentialVersion,
    registration: () => get<string>("registration"),
    saveRegistration: (id: string) => put("registration", id),
    plugin: (): PluginPermissions => get<PluginPermissions>("plugin") || { enabled: false, writes: false, pageIds: [] },
    setPlugin: (value: PluginPermissions) => put("plugin", value),
    pending: (state: string, attempt: Attempt) => { db.prepare("DELETE FROM attempts WHERE json_extract(body,'$.expiresAt')<?").run(Date.now()); db.prepare("INSERT INTO attempts VALUES (?,?)").run(hash(state), JSON.stringify(attempt)); },
    consume: (state: string, browserToken: string): Attempt => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db.prepare("SELECT body FROM attempts WHERE state=?").get(hash(state));
        const a = row ? JSON.parse(String(row.body)) as Attempt : null;
        if (!a || a.expiresAt < Date.now() || a.browserHash !== hash(browserToken)) throw new Error("Sign-in expired or belongs to another browser. Please try again.");
        db.prepare("DELETE FROM attempts WHERE state=?").run(hash(state)); db.exec("COMMIT"); return a;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    connect: (identity: Identity, tokens: Credentials, backup: () => void) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const existing = owner();
        if (existing && !sameOwner(existing, identity)) throw new Error("This workspace belongs to another ChatGPT owner. Sign in with its original account.");
        if (existing && existing.clientId !== identity.clientId) throw new Error("Account registration does not match the workspace owner.");
        if (!existing) backup();
        put("owner", identity); put("registration", identity.clientId); put("credentials", tokens); put("credential-version", credentialVersion() + 1);
        const session = randomBytes(32).toString("base64url");
        db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
        db.prepare("INSERT INTO sessions VALUES (?,?)").run(hash(session), Date.now() + 7 * 86400000);
        db.exec("COMMIT"); return session;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    verifySession: (token: string) => !!token && !!db.prepare("SELECT 1 FROM sessions WHERE hash=? AND expires>?").get(hash(token), Date.now()),
    revokeSession: (token: string) => db.prepare("DELETE FROM sessions WHERE hash=?").run(hash(token)),
    disconnect: () => { db.exec("BEGIN IMMEDIATE"); try { db.prepare("DELETE FROM vault WHERE id='credentials'").run(); put("credential-version", credentialVersion() + 1); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } },
    replaceCredentials: (tokens: Credentials, version: number): boolean => {
      db.exec("BEGIN IMMEDIATE"); try { const current = credentialVersion(); if (current !== version || !credentials()) { db.exec("COMMIT"); return false; } put("credentials", tokens); put("credential-version", current + 1); db.exec("COMMIT"); return true; } catch(e) { db.exec("ROLLBACK"); throw e; }
    },
    acquireRefresh: () => { const t = Date.now(); const r = db.prepare("INSERT INTO lease VALUES (1,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires WHERE expires<?").run(t + 35000, t); return Number(r.changes) === 1; },
    releaseRefresh: () => db.prepare("DELETE FROM lease WHERE id=1").run(),
    close: () => db.close(),
  };
}
export type Vault = ReturnType<typeof createVault>;
const globals = globalThis as unknown as { jotsteadVault?: Vault };
export const getVault = () => globals.jotsteadVault ??= createVault(dataDir());
export const browserHash = hash;
