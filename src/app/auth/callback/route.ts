import { finishAuthorization } from "@/lib/chatgpt";
import { getVault } from "@/lib/chatgpt-vault";
import { cookieValue } from "@/lib/auth";
import { getStore, dataDir } from "@/lib/store";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Next may use an internal hostname; the configured browser Host is the loopback callback.
  const host = req.headers.get("host") || url.host;
  const callback = new URL(url.pathname + url.search, `http://${host}`);
  let session: string | undefined;
  try {
    session = await finishAuthorization(
      getVault(),
      callback,
      cookieValue(req, "jotstead_oauth"),
      () => {
        const folder = join(dataDir(), "pre-chatgpt-backup");
        mkdirSync(folder, { recursive: true, mode: 0o700 });
        getStore().backup(join(folder, `workspace-${Date.now()}.sqlite`));
      },
    );
    const response = Response.redirect(
      callback.origin + "/?chatgpt=connected",
      303,
    );
    response.headers.append(
      "Set-Cookie",
      `jotstead_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    response.headers.append(
      "Set-Cookie",
      "jotstead_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    // Never reflect provider error/code/token content, nor an untrusted Host into a redirect.
    return new Response(
      "ChatGPT sign-in could not be completed. Open Jotstead at http://127.0.0.1:3000 and try again with the workspace owner's account. Your notes have not changed.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie":
            "jotstead_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        },
      },
    );
  }
}
