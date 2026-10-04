import { authorize, guard, isSameOrigin, readJson } from "@/lib/auth";
import { getVault } from "@/lib/chatgpt-vault";
import { disconnect, sharingEnabled } from "@/lib/chatgpt";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const v = getVault(), authenticated = authorize(req), owner = v.owner();
  return Response.json({ authenticated, ownerBound: !!owner, legacyPassword: !owner && !!process.env.JOTSTEAD_PASSWORD, connected: authenticated && !!v.credentials(), sharing: authenticated && sharingEnabled(v), ...(authenticated ? { account: owner ? { name: owner.name, email: owner.email } : null, plugin: v.plugin() } : {}) }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(req: Request) {
  const denied = guard(req, true); if (denied) return denied;
  try {
    const permissions = z.object({ enabled: z.boolean(), writes: z.boolean(), pageIds: z.array(z.string().max(80)).max(1000) }).parse(await readJson(req, 100000));
    getVault().setPlugin(permissions);
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Invalid plugin permissions" }, { status: 400 }); }
}
export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Same-origin request required" }, { status: 403 });
  const denied = guard(req); if (denied) return denied;
  return Response.json(await disconnect(getVault()), { headers: { "Cache-Control": "no-store" } });
}
