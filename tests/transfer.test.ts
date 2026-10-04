import { it, expect } from "vitest";
import {
  parseCsv,
  importCsv,
  parseWorkspaceExport,
  workspaceExport,
  csvExport,
  importMarkdown,
} from "../src/lib/transfer";
import { createSeed } from "../src/lib/seed";
it("roundtrips full workspace without losing view settings", () => {
  const w = createSeed();
  expect(parseWorkspaceExport(workspaceExport(w))).toEqual(w);
});
it("parses quoted CSV with multiline fields and protects spreadsheet formulas", () => {
  expect(parseCsv('Name,Notes\r\n"a,b","one\ntwo"')).toEqual([
    ["Name", "Notes"],
    ["a,b", "one\ntwo"],
  ]);
  expect(importCsv("Name,Note\nFirst,Hello", "Imported")).toHaveLength(2);
  const w = createSeed();
  w.pages.find((p) => p.id === "task-1")!.title = '=HYPERLINK("evil")';
  expect(
    csvExport(
      w,
      w.pages.find((p) => p.id === "projects")!,
    ),
  ).toContain("'=HYPERLINK");
});
it("rejects corrupt import without touching existing state", () => {
  const w = createSeed();
  const before = JSON.stringify(w);
  expect(() => parseWorkspaceExport('{"version":2}')).toThrow();
  expect(JSON.stringify(w)).toBe(before);
});
it("imports headings, tasks and code as structured blocks", () => {
  const p = importMarkdown(
    "# Test\n## Next\n- [x] Done\n```ts\nlet n = 1\n```",
    "Test",
  );
  expect(p.content.content?.map((n) => n.type)).toEqual([
    "heading",
    "taskList",
    "codeBlock",
  ]);
  expect(p.content.content?.[1].content?.[0].attrs?.checked).toBe(true);
});
it("roundtrips near-limit exports and rejects oversized canonical state", () => {
  const w = createSeed();
  w.pages[0].content = {
    type: "doc",
    content: Array.from({ length: 10000 }, () => ({
      type: "paragraph",
      content: [{ type: "text", text: "x".repeat(400) }],
    })),
  };
  expect(() => parseWorkspaceExport(workspaceExport(w))).not.toThrow();
  w.pages[0].content.content!.push(
    ...Array.from({ length: 2000 }, () => ({
      type: "paragraph",
      content: [{ type: "text", text: "x".repeat(1000) }],
    })),
  );
  expect(() => parseWorkspaceExport(workspaceExport(w))).toThrow();
});

it("keeps subsequent top-level Markdown headings inside the document", () => {
  const page = importMarkdown(
    "# Personal To-dos\n\n# Today\n\n- [ ] A task",
    "Imported",
  );
  expect(page.title).toBe("Personal To-dos");
  expect(page.content.content?.[0].type).toBe("heading");
});
