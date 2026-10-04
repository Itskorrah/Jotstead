import {
  makeSession,
  passwordMatches,
  isSameOrigin,
  readJson,
  cookieValue,
} from "@/lib/auth";
import { getVault } from "@/lib/chatgpt-vault";
import { getStore } from "@/lib/store";
export async function POST(req: Request) {
  if (getVault().owner())
    return Response.json(
      { error: "Continue with ChatGPT to open this workspace." },
      { status: 403 },
    );
  if (!isSameOrigin(req))
    return Response.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  if (!getStore().throttle("owner"))
    return Response.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  try {
    const body = await readJson(req, 4096);
    if (typeof body.password !== "string" || !passwordMatches(body.password))
      return Response.json(
        { error: "That password doesn’t match." },
        { status: 401 },
      );
    const secure =
      new URL(req.url).protocol === "https:" ||
      process.env.JOTSTEAD_COOKIE_SECURE === "1";
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": `jotstead_session=${makeSession(process.env.JOTSTEAD_PASSWORD!)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
export async function DELETE(req: Request) {
  if (!isSameOrigin(req))
    return Response.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  getVault().revokeSession(cookieValue(req, "jotstead_session"));
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie":
          "jotstead_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        "Clear-Site-Data": '"cache", "storage"',
      },
    },
  );
}
