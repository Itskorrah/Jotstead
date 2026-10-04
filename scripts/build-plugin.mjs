import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  plugin = resolve(root, "plugins/jotstead");
const ui = await build({
  entryPoints: [resolve(plugin, "ui/preview.ts")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
});
const template = await readFile(resolve(plugin, "ui/template.html"), "utf8");
const html = template.replace("/*JOTSTEAD_SCRIPT*/", () =>
  ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
);
await writeFile(resolve(plugin, "ui/preview.html"), html);
await mkdir(resolve(plugin, "server/dist"), { recursive: true });
await build({
  entryPoints: [resolve(root, "scripts/mcp.ts")],
  outfile: resolve(plugin, "server/dist/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  minify: true,
  define: { JOTSTEAD_PREVIEW_HTML: JSON.stringify(html) },
});
await mkdir(resolve(plugin, "assets"), { recursive: true });
await cp(
  resolve(root, "public/icons/icon-192.png"),
  resolve(plugin, "assets/icon.png"),
);
console.log(
  "Built Jotstead plugin: portable stdio runtime and MCP Apps preview",
);
