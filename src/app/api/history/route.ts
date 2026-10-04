import { guard } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { idSchema } from "@/lib/model";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("page");
  if (!idSchema.safeParse(id).success)
    return Response.json({ error: "Invalid page" }, { status: 400 });
  return Response.json(getStore().history(id!), {
    headers: { "Cache-Control": "no-store" },
  });
}
