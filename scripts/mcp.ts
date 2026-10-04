/** Local, owner-authorized MCP access. Run only for a trusted client. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getStore } from "../src/lib/store";
import {
  idSchema,
  newPage,
  textOf,
  now,
  trashPage,
  type Workspace,
  type Doc,
} from "../src/lib/model";
import { queryRows, runRules } from "../src/features/databases/query";
import { importMarkdown } from "../src/lib/transfer";
const server = new McpServer({ name: "jotstead", version: "1.0.0" });
const response = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
function write(expectedRevision: number, fn: (w: Workspace) => unknown) {
  const s = getStore().read();
  if (s.revision !== expectedRevision)
    throw new Error("Workspace changed. Read it again before editing.");
  const result = fn(s.data);
  const saved = getStore().save(s.data, s.revision, crypto.randomUUID());
  return response({ revision: saved.revision, result });
}
server.registerTool(
  "search_workspace",
  {
    description:
      "Search private workspace titles and text. Returns current revision for guarded edits.",
    inputSchema: { query: z.string().max(1000) },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const s = getStore().read();
    return response({
      revision: s.revision,
      pages: s.data.pages
        .filter(
          (p) =>
            !p.deletedAt &&
            (p.title + " " + textOf(p.content))
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, 50)
        .map((p) => ({
          id: p.id,
          title: p.title,
          parentId: p.parentId,
          kind: p.kind,
          excerpt: textOf(p.content).slice(0, 300),
        })),
    });
  },
);
server.registerTool(
  "read_page",
  {
    description: "Read a page with document JSON and database properties.",
    inputSchema: { id: idSchema },
    annotations: { readOnlyHint: true },
  },
  async ({ id }) => {
    const s = getStore().read();
    const page = s.data.pages.find((p) => p.id === id && !p.deletedAt);
    if (!page) throw new Error("Page not found");
    return response({ revision: s.revision, page });
  },
);
server.registerTool(
  "create_page",
  {
    description:
      "Create a page from basic Markdown. Requires revision from latest read.",
    inputSchema: {
      title: z.string().max(500),
      markdown: z.string().max(100000).default(""),
      parentId: idSchema.optional(),
      expectedRevision: z.number().int(),
    },
    annotations: { destructiveHint: false },
  },
  async ({ title, markdown, parentId, expectedRevision }) =>
    write(expectedRevision, (w) => {
      const p = importMarkdown(markdown, title);
      p.title = title;
      p.parentId = parentId || null;
      w.pages.push(p);
      return { id: p.id, title: p.title };
    }),
);
server.registerTool(
  "edit_page",
  {
    description:
      "Replace a page title and/or document with basic Markdown. Revision required. Prior version remains in history.",
    inputSchema: {
      id: idSchema,
      title: z.string().max(500).optional(),
      markdown: z.string().max(100000).optional(),
      expectedRevision: z.number().int(),
    },
    annotations: { destructiveHint: true },
  },
  async ({ id, title, markdown, expectedRevision }) =>
    write(expectedRevision, (w) => {
      const p = w.pages.find((p) => p.id === id && !p.deletedAt);
      if (!p) throw new Error("Page not found");
      if (title !== undefined) p.title = title;
      if (markdown !== undefined)
        p.content = importMarkdown(markdown, p.title).content as Doc;
      p.updatedAt = now();
      return { id: p.id };
    }),
);
server.registerTool(
  "trash_page",
  {
    description:
      "Move a page and descendants to recoverable Trash. Does not permanently delete data.",
    inputSchema: { id: idSchema, expectedRevision: z.number().int() },
    annotations: { destructiveHint: true },
  },
  async ({ id, expectedRevision }) =>
    write(expectedRevision, (w) => {
      trashPage(w, id);
      return { id };
    }),
);
server.registerTool(
  "query_database",
  {
    description:
      "Query a database using one of its saved views, or its default view.",
    inputSchema: {
      id: idSchema,
      viewId: idSchema.optional(),
      search: z.string().max(1000).default(""),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id, viewId, search }) => {
    const s = getStore().read();
    const db = s.data.pages.find(
      (p) => p.id === id && p.kind === "database" && !p.deletedAt,
    );
    if (!db) throw new Error("Database not found");
    const view = db.views.find((v) => v.id === viewId) || db.views[0];
    return response({
      revision: s.revision,
      properties: db.properties,
      rows: queryRows(s.data, db, view, search),
    });
  },
);
server.registerTool(
  "create_database_row",
  {
    description:
      "Create a row page in an existing database; property IDs and typed values come from query_database.",
    inputSchema: {
      databaseId: idSchema,
      title: z.string().max(500),
      values: z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.null(),
        ]),
      ),
      expectedRevision: z.number().int(),
    },
    annotations: { destructiveHint: false },
  },
  async ({ databaseId, title, values, expectedRevision }) =>
    write(expectedRevision, (w) => {
      if (
        !w.pages.some(
          (p) => p.id === databaseId && p.kind === "database" && !p.deletedAt,
        )
      )
        throw new Error("Database not found");
      const p = newPage(title, databaseId);
      p.values = values;
      w.pages.push(p);
      return { id: p.id };
    }),
);
server.registerTool(
  "update_database_row",
  {
    description:
      "Update typed row property values without replacing its note body.",
    inputSchema: {
      id: idSchema,
      values: z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.null(),
        ]),
      ),
      expectedRevision: z.number().int(),
    },
    annotations: { destructiveHint: true },
  },
  async ({ id, values, expectedRevision }) =>
    write(expectedRevision, (w) => {
      const p = w.pages.find((p) => p.id === id && !p.deletedAt);
      if (
        !p ||
        !w.pages.some((d) => d.id === p.parentId && d.kind === "database")
      )
        throw new Error("Row not found");
      p.values = { ...p.values, ...values };
      for (const key of Object.keys(values)) runRules(w, p, key);
      p.updatedAt = now();
      return { id: p.id };
    }),
);
await server.connect(new StdioServerTransport());
