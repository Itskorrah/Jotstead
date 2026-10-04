import {
  authorize,
  isSameOrigin,
  readJson,
  cookieValue,
  verifySession,
} from "@/lib/auth";
import { startAuthorization } from "@/lib/chatgpt";
import { getVault } from "@/lib/chatgpt-vault";
import { getStore } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return Response.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  const origin = req.headers.get("origin")!,
    url = new URL(origin);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
    return Response.json(
      {
        error:
          "Open Jotstead at http://127.0.0.1:" +
          (url.port || "3000") +
          " to connect ChatGPT on this computer.",
      },
      { status: 400 },
    );
  if (!getStore().throttle("chatgpt-start"))
    return Response.json(
      { error: "Too many sign-in attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  try {
    const body = await readJson(req, 1024),
      sharing = body.sharing === true;
    if (sharing && !authorize(req))
      return Response.json(
        { error: "Sign in before enabling AI usage" },
        { status: 401 },
      );
    const vault = getVault();
    const migrationSession =
      !vault.owner() && process.env.JOTSTEAD_PASSWORD
        ? cookieValue(req, "jotstead_session")
        : undefined;
    if (
      !vault.owner() &&
      process.env.JOTSTEAD_PASSWORD &&
      !verifySession(migrationSession || "", process.env.JOTSTEAD_PASSWORD)
    )
      return Response.json(
        {
          error:
            "Open your workspace with its existing password before connecting ChatGPT.",
        },
        { status: 401 },
      );
    const result = startAuthorization(
      vault,
      origin + "/auth/callback",
      sharing,
      migrationSession,
    );
    return Response.json(
      { url: result.url },
      {
        headers: {
          "Set-Cookie": `jotstead_oauth=${result.browserToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error &&
          /^(Set JOTSTEAD_CHATGPT_CLIENT_ID|The configured client)/.test(
            e.message,
          )
            ? e.message
            : "Could not start ChatGPT sign-in. Please try again.",
      },
      { status: 400 },
    );
  }
}
