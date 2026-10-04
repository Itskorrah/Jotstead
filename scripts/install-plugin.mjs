/** Prepare a machine-local package without changing the portable source or exposing credentials. */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const root = resolve(import.meta.dirname, "..");
for (const filename of [".env.local", ".env"]) {
  const file = join(root, filename);
  if (existsSync(file)) process.loadEnvFile(file);
}
const target = join(root, ".codex/local-marketplace"),
  plugin = join(target, "plugins/jotstead");
await mkdir(join(target, ".agents/plugins"), { recursive: true });
await cp(join(root, "plugins/jotstead"), plugin, { recursive: true });
const manifest = JSON.parse(
  await readFile(join(plugin, "plugin.json"), "utf8"),
);
const mcp = JSON.parse(await readFile(join(plugin, "mcp.json"), "utf8"));
mcp.mcpServers.jotstead.command = process.execPath;
mcp.mcpServers.jotstead.env.JOTSTEAD_DATA_DIR = resolve(
  root,
  process.env.JOTSTEAD_DATA_DIR || "data",
);
await writeFile(join(plugin, "mcp.json"), JSON.stringify(mcp, null, 2) + "\n");
await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
await writeFile(
  join(plugin, ".codex-plugin/plugin.json"),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      skills: "./skills/",
      mcpServers: "./mcp.json",
      interface: manifest.extensions["com.openai"].interface,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(target, ".agents/plugins/marketplace.json"),
  JSON.stringify(
    {
      name: "jotstead-local",
      plugins: [
        {
          name: "jotstead",
          source: { source: "local", path: "./plugins/jotstead" },
          policy: { installation: "AVAILABLE", authentication: "ON_USE" },
          category: "Productivity",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
for (const args of [
  ["plugin", "marketplace", "add", target, "--json"],
  ["plugin", "add", "jotstead@jotstead-local", "--json"],
]) {
  const result = spawnSync("codex", args, { stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      "Plugin installation could not finish. The prepared package remains at " +
        plugin,
    );
}
console.log(
  "Installed Jotstead local plugin. Enable its page scope in Jotstead Settings, then reload the desktop host.",
);
