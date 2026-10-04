import {
  type Workspace,
  type Page,
  type Doc,
  descendants,
  uid,
  now,
  validateWorkspace,
} from "./model";
export function duplicateTree(w: Workspace, id: string): Page {
  const original = w.pages.find((p) => p.id === id);
  if (!original) throw new Error("Page not found");
  const originals = w.pages.filter(
    (p) => p.id === id || descendants(w, id).includes(p.id),
  );
  const ids = new Map(originals.map((p) => [p.id, uid()]));
  const remap = (n: Doc) => {
    if (n.type === "pageLink" && ids.has(String(n.attrs?.pageId)))
      n.attrs!.pageId = ids.get(String(n.attrs!.pageId));
    for (const m of n.marks || []) {
      const match = String(m.attrs?.href || "").match(
        /^\/\?page=([a-zA-Z0-9_-]+)$/,
      );
      if (match && ids.has(match[1]))
        m.attrs!.href = "/?page=" + ids.get(match[1]);
    }
    n.content?.forEach(remap);
  };
  const copies = originals.map((p) => {
    const c = structuredClone(p);
    c.id = ids.get(p.id)!;
    c.parentId = ids.get(p.parentId || "") || p.parentId;
    c.published = false;
    c.formEnabled = false;
    c.favorite = false;
    c.createdAt = now();
    c.updatedAt = now();
    if (p.id === id) c.title += " copy";
    remap(c.content);
    for (const prop of c.properties)
      if (prop.targetId && ids.has(prop.targetId))
        prop.targetId = ids.get(prop.targetId);
    const parent = w.pages.find((d) => d.id === p.parentId);
    for (const prop of parent?.properties || [])
      if (prop.type === "relation" && Array.isArray(c.values[prop.id]))
        c.values[prop.id] = (c.values[prop.id] as string[]).map(
          (v) => ids.get(v) || v,
        );
    return c;
  });
  w.pages.push(...copies);
  return copies.find((p) => p.id === ids.get(id))!;
}
/** Restore document/presentation, preserving live schema, properties, location, and sharing. */
export function restorePageSnapshot(w: Workspace, id: string, snapshot: Page) {
  const i = w.pages.findIndex((p) => p.id === id);
  if (i < 0) throw new Error("Page not found");
  const current = w.pages[i];
  const candidate = structuredClone(w);
  candidate.pages[i] = {
    ...structuredClone(snapshot),
    id,
    kind: current.kind,
    parentId: current.parentId,
    properties: current.properties,
    views: current.views,
    values: current.values,
    published: current.published,
    formEnabled: current.formEnabled,
    deletedAt: current.deletedAt,
    updatedAt: now(),
  };
  validateWorkspace(candidate);
  w.pages[i] = candidate.pages[i];
}
