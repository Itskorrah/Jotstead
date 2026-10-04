import { it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

it("serves real MCP tools, persists edits, and rejects stale agent writes", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "scripts/mcp.ts"],
    cwd: process.cwd(),
    env: { JOTSTEAD_DATA_DIR: mkdtempSync(join(tmpdir(), "jotstead-mcp-")) },
    stderr: "pipe",
  });
  const client = new Client({ name: "jotstead-validation", version: "1.0.0" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(8);
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
        expectedRevision: first.revision,
      },
    });
    const result = JSON.parse((created.content as { text: string }[])[0].text);
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
  } finally {
    await client.close();
  }
}, 15000);
