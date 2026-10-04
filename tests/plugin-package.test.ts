import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";
it("packages a syntactically valid self-contained MCP Apps script", () => {
  const html = readFileSync("plugins/jotstead/ui/preview.html", "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  expect(() => new Script(script!)).not.toThrow();
  expect(existsSync("plugins/jotstead/server/dist/index.js")).toBe(true);
  const manifest = JSON.parse(
    readFileSync("plugins/jotstead/plugin.json", "utf8"),
  );
  expect(
    manifest.extensions["com.openai"].interface.shortDescription.length,
  ).toBeLessThanOrEqual(30);
});
