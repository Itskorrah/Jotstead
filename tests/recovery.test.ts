import { it, expect } from "vitest";
import { duplicateTree, restorePageSnapshot } from "../src/lib/commands";
import { createSeed } from "../src/lib/seed";
import { validateWorkspace } from "../src/lib/model";
it("duplicates nested links and self relations into the copied subtree", () => {
  const w = createSeed();
  const copy = duplicateTree(w, "home");
  const child = w.pages.find((p) => p.parentId === copy.id)!;
  const link = copy.content.content?.find((n) => n.type === "pageLink");
  expect(link?.attrs?.pageId).toBe(child.id);
  const db = w.pages.find((p) => p.id === "projects")!;
  db.properties.push({
    id: "related",
    name: "Related",
    type: "relation",
    targetId: db.id,
  });
  w.pages.find((p) => p.id === "task-1")!.values.related = ["task-2"];
  const copiedDb = duplicateTree(w, db.id);
  expect(copiedDb.properties.find((p) => p.id === "related")?.targetId).toBe(
    copiedDb.id,
  );
  const copiedRows = w.pages.filter((p) => p.parentId === copiedDb.id);
  expect(copiedRows[0].values.related).toEqual([copiedRows[1].id]);
  expect(() => validateWorkspace(w)).not.toThrow();
});
it("restores history without breaking current database values or re-enabling publication", () => {
  const w = createSeed(),
    db = w.pages.find((p) => p.id === "projects")!,
    old = structuredClone(db);
  old.formEnabled = true;
  db.properties.find((p) => p.id === "effort")!.type = "text";
  for (const r of w.pages.filter((r) => r.parentId === db.id))
    r.values.effort = "Later text";
  db.formEnabled = false;
  restorePageSnapshot(w, db.id, old);
  expect(db.formEnabled).toBe(false);
  expect(
    w.pages
      .find((p) => p.id === db.id)
      ?.properties.find((p) => p.id === "effort")?.type,
  ).toBe("text");
  expect(() => validateWorkspace(w)).not.toThrow();
});
