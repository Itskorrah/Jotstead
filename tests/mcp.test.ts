import { it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVault } from "../src/lib/chatgpt-vault";
import { createSeed } from "../src/lib/seed";

it.each([
  ["--import", "tsx", "scripts/mcp.ts"],
  ["plugins/jotstead/server/dist/index.js"],
])(
  "serves real MCP tools from %j, persists edits, and rejects stale agent writes",
  async (...args) => {
    const root = mkdtempSync(join(tmpdir(), "jotstead-mcp-")),
      vault = createVault(root);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args,
      cwd: process.cwd(),
      env: { JOTSTEAD_DATA_DIR: root },
      stderr: "pipe",
    });
    const client = new Client({
      name: "jotstead-validation",
      version: "1.0.0",
    });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools.map((t) => t.name)).toContain(
        "save_to_jotstead",
      );
      const disabled = await client.callTool({
        name: "search_workspace",
        arguments: { query: "" },
      });
      expect(disabled.isError).toBe(true);
      vault.setPlugin({ enabled: true, writes: true, pageIds: ["projects"] });
      const scoped = await client.callTool({
        name: "query_database",
        arguments: { id: "projects" },
      });
      expect(
        JSON.parse((scoped.content as { text: string }[])[0].text).rows,
      ).toHaveLength(0);
      vault.setPlugin({
        enabled: true,
        writes: true,
        pageIds: createSeed().pages.map((p) => p.id),
      });
      const read = await client.callTool({
        name: "search_workspace",
        arguments: { query: "Getting started" },
      });
      const first = JSON.parse((read.content as { text: string }[])[0].text);
      const created = await client.callTool({
        name: "create_page",
        arguments: {
          title: "MCP verification",
          markdown: "# A real document\nA persisted note.",
          parentId: first.pages[0].id,
          expectedRevision: first.revision,
        },
      });
      const result = JSON.parse(
        (created.content as { text: string }[])[0].text,
      );
      vault.setPlugin({
        ...vault.plugin(),
        pageIds: [...vault.plugin().pageIds, result.result.id],
      });
      const page = await client.callTool({
        name: "read_page",
        arguments: { id: result.result.id },
      });
      expect(
        JSON.parse((page.content as { text: string }[])[0].text).page.title,
      ).toBe("MCP verification");
      const stale = await client.callTool({
        name: "edit_page",
        arguments: {
          id: result.result.id,
          title: "Must not overwrite",
          expectedRevision: first.revision,
        },
      });
      expect(stale.isError).toBe(true);
      const query = await client.callTool({
        name: "query_database",
        arguments: { id: "projects" },
      });
      expect(
        JSON.parse((query.content as { text: string }[])[0].text).rows,
      ).toHaveLength(6);
      const trash = await client.callTool({
        name: "trash_page",
        arguments: { id: result.result.id, expectedRevision: result.revision },
      });
      expect(trash.isError).not.toBe(true);
      const brief = await client.callTool({
        name: "update_project_brief",
        arguments: {
          id: "projects",
          brief: {
            goals: "Ship",
            preferences: "Concise",
            decisions: "Test first",
            nextActions: "Review",
          },
          expectedRevision: result.revision + 1,
        },
      });
      expect(brief.isError).not.toBe(true);
      const preview = await client.callTool({
        name: "preview_page",
        arguments: { id: "projects" },
      });
      expect(preview.structuredContent).toMatchObject({
        page: { id: "projects", sharedBrief: { goals: "Ship" } },
      });
      const resources = await client.listResources();
      expect(
        resources.resources.some((r) => r.uri === "ui://jotstead/preview.html"),
      ).toBe(true);
      const ui = await client.readResource({
        uri: "ui://jotstead/preview.html",
      });
      expect((ui.contents[0] as { text: string }).text).toContain("Jotstead");
      vault.setPlugin({ enabled: true, writes: false, pageIds: ["projects"] });
      const blocked = await client.callTool({
        name: "create_tasks",
        arguments: {
          parentId: "projects",
          tasks: ["Review"],
          expectedRevision: result.revision + 2,
          mutationId: "00000000-0000-4000-8000-000000000001",
        },
      });
      expect(blocked.isError).toBe(true);
    } finally {
      await client.close();
      vault.close();
    }
  },
  15000,
);
