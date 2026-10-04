import { z } from "zod";
import { idSchema, textOf, now, type Workspace } from "./model";
import { importMarkdown } from "./transfer";
import { sourceChatSchema } from "./shared-brief";
export { briefSchema } from "./shared-brief";
export const captureSchema = z.object({
  mode: z.enum(["create", "append"]),
  pageId: idSchema.optional(),
  parentId: idSchema.optional(),
  title: z.string().max(500).default("Saved from ChatGPT"),
  markdown: z.string().min(1).max(100000),
  sourceChatUrl: sourceChatSchema.optional(),
});
export type CaptureInput = z.input<typeof captureSchema>;
export function selectedContext(w: Workspace, ids: string[]) {
  if (ids.length > 12) throw new Error("Choose up to 12 context pages");
  const pages = [...new Set(ids)].map((id) => {
    const p = w.pages.find((p) => p.id === id && !p.deletedAt);
    if (!p)
      throw new Error(
        "A selected context page is unavailable. Review your selection.",
      );
    return p;
  });
  const text = pages
    .map(
      (p) =>
        `[${p.id}] ${p.title}\n${textOf(p.content).slice(0, 12000)}${p.sharedBrief ? `\nShared project brief:\n${JSON.stringify(p.sharedBrief)}` : ""}`,
    )
    .join("\n\n");
  if (text.length > 60000)
    throw new Error("Selected pages are too large. Choose fewer pages.");
  return { text, sources: pages.map((p) => ({ id: p.id, title: p.title })) };
}
export function saveSelection(
  w: Workspace,
  input: CaptureInput,
  newId?: string,
) {
  const capture = captureSchema.parse(input);
  const imported = importMarkdown(capture.markdown, capture.title);
  if (capture.sourceChatUrl)
    imported.content.content = [
      ...(imported.content.content || []),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Source conversation",
            marks: [{ type: "link", attrs: { href: capture.sourceChatUrl } }],
          },
        ],
      },
    ];
  if (capture.mode === "append") {
    const p = w.pages.find((p) => p.id === capture.pageId && !p.deletedAt);
    if (!p) throw new Error("Choose an available destination page");
    if (p.kind === "database")
      throw new Error(
        "A database destination needs a new child page or task row, rather than a hidden append.",
      );
    p.content.content = [
      ...(p.content.content || []),
      ...(imported.content.content || []),
    ];
    p.updatedAt = now();
    return { id: p.id, title: p.title };
  }
  if (
    capture.parentId &&
    !w.pages.some((p) => p.id === capture.parentId && !p.deletedAt)
  )
    throw new Error("Choose an available destination parent");
  const p = imported;
  p.title = capture.title;
  p.parentId = capture.parentId || null;
  if (newId) p.id = idSchema.parse(newId);
  w.pages.push(p);
  return { id: p.id, title: p.title };
}
