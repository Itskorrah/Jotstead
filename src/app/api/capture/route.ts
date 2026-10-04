import { guard, readJson } from "@/lib/auth";
import { getStore, isConflictError } from "@/lib/store";
import { captureSchema, saveSelection } from "@/lib/shared-context";
import { z } from "zod";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const denied = guard(req, true); if (denied) return denied;
  try {
    const body = captureSchema.extend({ expectedRevision: z.number().int().nonnegative(), mutationId: z.string().uuid() }).parse(await readJson(req, 150000));
    const store = getStore(), s = store.read();
    const id = body.mode === "create" ? `capture-${createHash("sha256").update(body.mutationId).digest("hex").slice(0, 32)}` : body.pageId;
    if (store.hasMutation(body.mutationId)) return Response.json({ revision: s.revision, pageId: id });
    const result = saveSelection(s.data, body, id);
    const saved = store.save(s.data, body.expectedRevision, body.mutationId);
    return Response.json({ revision: saved.revision, pageId: result.id });
  } catch(e) { return Response.json({ error: e instanceof Error ? e.message : "Could not save selection" }, { status: isConflictError(e) ? 409 : 400 }); }
}
