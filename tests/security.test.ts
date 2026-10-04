import { it, expect } from "vitest";
import { publishedPage, attachmentReferenced } from "../src/lib/public";
import { createSeed } from "../src/lib/seed";
import { validateWorkspace } from "../src/lib/model";
import { guard, authorize } from "../src/lib/auth";
it("public output omits private properties, comments and page links", () => {
  const page = createSeed().pages[0];
  page.values.secret = "private";
  page.comments.push({
    id: "comment",
    text: "private",
    createdAt: "now",
    blockId: null,
  });
  const p = publishedPage(page);
  expect(p).not.toHaveProperty("values");
  expect(p).not.toHaveProperty("comments");
  expect(JSON.stringify(p.content)).not.toContain("/?page=guide");
});
it("rejects unsafe image URLs and excessive document nesting", () => {
  const w = createSeed();
  w.pages[0].content = {
    type: "doc",
    content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }],
  };
  expect(() => validateWorkspace(w)).toThrow(/Unsafe/);
  let n = { type: "paragraph" } as (typeof w.pages)[0]["content"];
  for (let i = 0; i < 34; i++) n = { type: "callout", content: [n] };
  w.pages[0].content = { type: "doc", content: [n] };
  expect(() => validateWorkspace(w)).toThrow(/depth/);
});
it("only references attachments actually used by the published page", () => {
  const p = createSeed().pages[0];
  p.content = {
    type: "doc",
    content: [{ type: "image", attrs: { src: "/api/uploads/asset-one" } }],
  };
  expect(attachmentReferenced(p, "asset-one")).toBe(true);
  expect(attachmentReferenced(p, "private-other")).toBe(false);
});
it("password configured denies anonymous requests and forged bearer headers", () => {
  const before = process.env.JOTSTEAD_PASSWORD;
  process.env.JOTSTEAD_PASSWORD = "test-secret";
  expect(authorize(new Request("http://localhost:3000/api/workspace"))).toBe(
    false,
  );
  expect(
    guard(
      new Request("http://localhost:3000/api/workspace", {
        headers: { Authorization: "Bearer fake", origin: "https://evil.test" },
      }),
      true,
    )?.status,
  ).toBe(401);
  if (before === undefined) delete process.env.JOTSTEAD_PASSWORD;
  else process.env.JOTSTEAD_PASSWORD = before;
});
it("rejects structurally invalid editor documents before saving", () => {
  const w = createSeed();
  w.pages[0].content = {
    type: "doc",
    content: [{ type: "text", text: "Invalid root text" }],
  };
  expect(() => validateWorkspace(w)).toThrow(/structure/);
});
it("rejects unsafe table spans and accepts bounded merged cells", () => {
  const w = createSeed();
  const table = {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            attrs: { colspan: 1_000_000_000, rowspan: 1, colwidth: null },
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  };
  w.pages[0].content = { type: "doc", content: [table] };
  expect(() => validateWorkspace(w)).toThrow(/Table|table/);
  table.content[0].content[0].attrs.colspan = 2;
  table.content[0].content[0].attrs.colwidth = [120, 120] as never;
  expect(() => validateWorkspace(w)).not.toThrow();
});
