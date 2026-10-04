import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { getVault } from "./chatgpt-vault";
const duration = 7 * 86400000;
function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function equal(a: string, b: string) {
  const x = createHash("sha256").update(a).digest(),
    y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
export function makeSession(secret: string, time = Date.now()) {
  const expiry = String(time + duration);
  return `${expiry}.${sign(expiry, secret)}`;
}
export function verifySession(
  value: string,
  secret: string,
  time = Date.now(),
) {
  const [expiry, sig] = value.split(".");
  return (
    !!sig &&
    Number(expiry) > time &&
    Number(expiry) <= time + duration &&
    equal(sig, sign(expiry, secret))
  );
}
export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const expected =
    process.env.JOTSTEAD_PUBLIC_URL?.replace(/\/$/, "") ||
    url.protocol + "//" + (req.headers.get("host") || url.host);
  return !!origin && origin === expected;
}
export function authorize(req: Request): boolean {
  const token = process.env.JOTSTEAD_API_TOKEN;
  const bearer = req.headers.get("authorization");
  if (token && bearer?.startsWith("Bearer ") && equal(bearer.slice(7), token))
    return true;
  const session = cookieValue(req, "jotstead_session");
  const vault = getVault();
  if (vault.owner()) return vault.verifySession(session);
  const password = process.env.JOTSTEAD_PASSWORD;
  if (!password) {
    return process.env.JOTSTEAD_LOCAL_ONLY === "1" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(req.url).hostname);
  }
  return verifySession(session, password);
}
export function cookieValue(req: Request, name: string) { return req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="))?.slice(name.length + 1) || ""; }
export function guard(req: Request, write = false): Response | null {
  if (!authorize(req))
    return Response.json(
      { error: "Sign in to your workspace", authRequired: true },
      { status: 401 },
    );
  if (
    write &&
    !isSameOrigin(req) &&
    !(
      process.env.JOTSTEAD_API_TOKEN &&
      req.headers.get("authorization")?.startsWith("Bearer ") &&
      equal(
        req.headers.get("authorization")!.slice(7),
        process.env.JOTSTEAD_API_TOKEN,
      )
    )
  )
    return Response.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  return null;
}
export function passwordMatches(candidate: string) {
  return (
    !!process.env.JOTSTEAD_PASSWORD &&
    equal(candidate, process.env.JOTSTEAD_PASSWORD)
  );
}
export async function readBytes(req: Request, limit: number) {
  if (Number(req.headers.get("content-length")) > limit)
    throw new Error("Request too large");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Empty request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson(req: Request, limit = 6 * 1024 * 1024) {
  return JSON.parse((await readBytes(req, limit)).toString("utf8"));
}
