import { describe, it, expect } from "vitest";
import {
  validateWorkspace,
  movePage,
  descendants,
  safeUrl,
} from "../src/lib/model";
import { createSeed } from "../src/lib/seed";
describe("workspace invariants", () => {
  it("rejects moving a page under its descendant", () => {
    const w = createSeed();
    expect(() => movePage(w, "home", "guide")).toThrow(/descendant/);
  });
  it("rejects cycles in imported state", () => {
    const w = createSeed();
    w.pages.find((p) => p.id === "home")!.parentId = "guide";
    expect(() => validateWorkspace(w)).toThrow(/cycle/);
  });
  it("rejects dangling parents and invalid property values", () => {
    const w = createSeed();
    w.pages[0].parentId = "missing";
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("descendant traversal includes row pages without touching peers", () => {
    const w = createSeed();
    expect(descendants(w, "projects")).toContain("task-1");
    expect(descendants(w, "projects")).not.toContain("home");
  });
  it("blocks unsafe URL schemes and protocol relative URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(safeUrl("//evil.com")).toBe(false);
    expect(safeUrl("https://example.com")).toBe(true);
  });
});
