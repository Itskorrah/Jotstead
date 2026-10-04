import { finishAuthorization, ChatGPTSignInError } from "@/lib/chatgpt";
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
  let session: string | undefined;
  try {
    const callback = new URL(url.pathname + url.search, `http://${host}`);
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
  } catch (e) {
    // Never reflect provider error/code/token content, nor an untrusted Host into a redirect.
    const safeError = new ChatGPTSignInError(
      e instanceof ChatGPTSignInError ? e.code : "failed",
    );
    return new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatGPT sign-in · Jotstead</title><style>html{color-scheme:light dark;font:16px/1.6 system-ui}body{margin:0;min-height:100svh;display:grid;place-items:center;background:light-dark(#fafaf9,#191919);color:light-dark(#292927,#e7e7e5)}main{width:min(440px,calc(100% - 48px));padding:48px 0}h1{font-size:26px;line-height:1.25}p{color:light-dark(#656560,#aaa9a5)}a{color:inherit}a.button{display:block;text-align:center;text-decoration:none;padding:12px 16px;border-radius:7px;background:light-dark(#292927,#e7e7e5);color:light-dark(#fff,#191919);margin-top:28px}a:focus-visible{outline:3px solid #6597bf;outline-offset:4px}</style><main><p>Jotstead</p><h1>ChatGPT sign-in didn’t finish.</h1><p role="alert">${safeError.message}</p><a class="button" href="/">Return to Jotstead</a><p><a href="https://developers.openai.com/siwc/token-sharing-open-source/sign-in" rel="noreferrer">OpenAI sign-in requirements</a></p></main></html>`,
      {
        status: 400,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie":
            "jotstead_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        },
      },
    );
  }
}
