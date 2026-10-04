import { authorize } from "@/lib/auth";
import { getStore, dataDir } from "@/lib/store";
import { idSchema } from "@/lib/model";
import { attachmentReferenced } from "@/lib/public";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success)
    return new Response("Not found", { status: 404 });
  if (
    !authorize(req) &&
    !getStore()
      .read()
      .data.pages.some(
        (p) => p.published && !p.deletedAt && attachmentReferenced(p, id),
      )
  )
    return new Response("Not found", { status: 404 });
  try {
    const dir = join(dataDir(), "uploads");
    const meta = JSON.parse(await readFile(join(dir, id + ".json"), "utf8"));
    const bytes = await readFile(join(dir, id));
    return new Response(bytes, {
      headers: {
        "Content-Type": meta.mime,
        "Content-Disposition": `${meta.image ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
