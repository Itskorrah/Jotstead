import { it, expect } from "vitest";
import { createSeed } from "../src/lib/seed";
import { validateWorkspace, textOf } from "../src/lib/model";
import { selectedContext, saveSelection, briefSchema } from "../src/lib/shared-context";
it("includes only selected live pages and their shared brief", () => {
  const w = createSeed(), p = w.pages[0];
  p.sharedBrief = briefSchema.parse({ goals: "Build a calm workspace", preferences: "Be concise", decisions: "Use ChatGPT", nextActions: "Test it" });
  const context = selectedContext(w, [p.id]);
  expect(context.sources.map(s => s.id)).toEqual([p.id]);
  expect(context.text).toContain("Build a calm workspace");
  expect(context.text).not.toContain(w.pages[1].title);
  expect(selectedContext(w, []).text).toBe("");
  p.deletedAt = new Date().toISOString();
  expect(() => selectedContext(w, [p.id])).toThrow(/unavailable/i);
});
it("saves selected content with source attribution while preserving existing blocks", () => {
  const w = createSeed(), id = w.pages[0].id, before = textOf(w.pages[0].content);
  const result = saveSelection(w, { mode: "append", pageId: id, markdown: "## Decision\nShip it", sourceChatUrl: "https://chatgpt.com/c/abc-123", title: "Saved decision" });
  expect(result.id).toBe(id);
  expect(textOf(w.pages[0].content)).toContain(before);
  expect(textOf(w.pages[0].content)).toContain("Ship it");
  expect(JSON.stringify(w.pages[0].content)).toContain("https://chatgpt.com/c/abc-123");
  expect(() => saveSelection(w, { mode: "append", pageId: id, markdown: "bad", sourceChatUrl: "javascript:alert(1)" })).toThrow();
  const validated = validateWorkspace(w);
  expect(validated.pages[0].content).toEqual(w.pages[0].content);
});
it("roundtrips a shared brief through workspace validation and refuses invalid parents", () => {
  const w = createSeed(); w.pages[0].sharedBrief = briefSchema.parse({ goals: "Goal", preferences: "", decisions: "", nextActions: "" });
  expect(validateWorkspace(w).pages[0].sharedBrief?.goals).toBe("Goal");
  expect(() => saveSelection(w, { mode: "create", parentId: "missing", markdown: "Plan" })).toThrow(/destination/i);
});
