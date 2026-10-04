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
import { getVault } from "../src/lib/chatgpt-vault";
import {
  briefSchema,
  captureSchema,
  saveSelection,
} from "../src/lib/shared-context";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
declare const JOTSTEAD_PREVIEW_HTML: string;
const server = new McpServer({ name: "jotstead", version: "1.1.1" });
const permission = (write = false) => {
  const p = getVault().plugin();
  if (!p.enabled)
    throw new Error(
      "Enable the personal plugin in Jotstead Settings → ChatGPT & integrations.",
    );
  if (write && !p.writes)
    throw new Error(
      "Plugin writes are disabled. Enable selected saves and edits in Jotstead Settings.",
    );
  return p;
};
const allowed = (id: string) => {
  if (!permission().pageIds.includes(id))
    throw new Error("This page is outside the plugin's selected scope.");
};
const scoped = (w: Workspace) => ({
  ...w,
  pages: w.pages.filter((p) => permission().pageIds.includes(p.id)),
});
const response = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
function write(
  expectedRevision: number,
  fn: (w: Workspace) => unknown,
  mutationId = crypto.randomUUID(),
) {
  const permissions = permission(true),
    store = getStore(),
    s = store.read();
  if (store.hasMutation(mutationId))
    return response({ revision: s.revision, alreadyApplied: true });
  if (s.revision !== expectedRevision)
    throw new Error("Workspace changed. Read it again before editing.");
  const previous = new Map(s.data.pages.map((p) => [p.id, JSON.stringify(p)]));
  const result = fn(s.data);
  for (const p of s.data.pages) {
    const old = previous.get(p.id);
    if (old === JSON.stringify(p)) continue;
    if (
      old
        ? !permissions.pageIds.includes(p.id)
        : !p.parentId || !permissions.pageIds.includes(p.parentId)
    )
      throw new Error(
        "The edit touches a page outside the selected plugin scope. Select each destination and affected child in Settings.",
      );
  }
  // Recheck permission after synchronous mutation construction, before persistence.
  permission(true);
  const saved = store.save(s.data, s.revision, mutationId);
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
    permission();
    const s = getStore().read();
    return response({
      revision: s.revision,
      pages: scoped(s.data)
        .pages.filter(
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
    permission();
    const s = getStore().read();
    allowed(id);
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
    permission();
    const s = getStore().read();
    allowed(id);
    const db = s.data.pages.find(
      (p) => p.id === id && p.kind === "database" && !p.deletedAt,
    );
    if (!db) throw new Error("Database not found");
    const view = db.views.find((v) => v.id === viewId) || db.views[0];
    return response({
      revision: s.revision,
      properties: db.properties,
      rows: queryRows(scoped(s.data), db, view, search),
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
const previewUri = "ui://jotstead/preview.html";
const previewHtml =
  typeof JOTSTEAD_PREVIEW_HTML !== "undefined"
    ? JOTSTEAD_PREVIEW_HTML
    : readFileSync(
        new URL("../plugins/jotstead/ui/preview.html", import.meta.url),
        "utf8",
      );
server.registerResource(
  "jotstead-preview",
  previewUri,
  {
    title: "Jotstead page preview",
    mimeType: "text/html;profile=mcp-app",
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
  },
  async () => ({
    contents: [
      {
        uri: previewUri,
        mimeType: "text/html;profile=mcp-app",
        text: previewHtml,
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
      },
    ],
  }),
);
const uiMeta = { ui: { resourceUri: previewUri } };
function preview(id?: string) {
  permission();
  const s = getStore().read(),
    permitted = scoped(s.data).pages.filter((p) => !p.deletedAt);
  if (id) allowed(id);
  const page = id ? permitted.find((p) => p.id === id) : undefined;
  if (id && !page) throw new Error("Page not found");
  const value = {
    revision: s.revision,
    pages: permitted.map((p) => ({ id: p.id, title: p.title })),
    page: page
      ? {
          id: page.id,
          kind: page.kind,
          title: page.title,
          text: textOf(page.content).slice(0, 60000),
          sharedBrief: page.sharedBrief,
          tasks: permitted
            .filter((p) => p.parentId === page.id)
            .map((p) => ({ id: p.id, title: p.title })),
        }
      : null,
  };
  return { ...response(value), structuredContent: value };
}
server.registerTool(
  "preview_page",
  {
    title: "Page preview",
    description:
      "Preview a selected page and shared project brief beside the conversation. Read-only.",
    inputSchema: { id: idSchema },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: uiMeta,
  },
  async ({ id }) => preview(id),
);
server.registerTool(
  "open_jotstead",
  {
    title: "Project companion",
    description:
      "Open the selected Jotstead pages in a conversation panel. Does not read ChatGPT conversation history.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ...uiMeta, "openai/ui": { entrypoints: [{ type: "thread" }] } },
  },
  async () => preview(),
);
server.registerTool(
  "read_project_brief",
  {
    description:
      "Read the shared goals, preferences, decisions and next actions on a selected page.",
    inputSchema: { id: idSchema },
    annotations: { readOnlyHint: true },
  },
  async ({ id }) => {
    allowed(id);
    const s = getStore().read(),
      p = s.data.pages.find((p) => p.id === id && !p.deletedAt);
    if (!p) throw new Error("Page not found");
    return response({ revision: s.revision, id, brief: p.sharedBrief || null });
  },
);
server.registerTool(
  "update_project_brief",
  {
    description:
      "Update the selected shared project brief. Requires a fresh revision; prior brief remains in page history.",
    inputSchema: {
      id: idSchema,
      brief: briefSchema,
      expectedRevision: z.number().int().nonnegative(),
      mutationId: z.string().uuid().optional(),
    },
    annotations: { destructiveHint: false },
  },
  async ({ id, brief, expectedRevision, mutationId }) =>
    write(
      expectedRevision,
      (w) => {
        const p = w.pages.find((p) => p.id === id && !p.deletedAt);
        if (!p) throw new Error("Page not found");
        p.sharedBrief = brief;
        p.updatedAt = now();
        return { id };
      },
      mutationId,
    ),
);
server.registerTool(
  "save_to_jotstead",
  {
    description:
      "Save only the user's selected summary, decision, draft or plan to an allowed destination. Append preserves blocks; new pages need a selected parent. An optional real source chat URL is retained. Fresh revision and retry-stable mutation UUID required.",
    inputSchema: {
      ...captureSchema.shape,
      expectedRevision: z.number().int().nonnegative(),
      mutationId: z.string().uuid(),
    },
    annotations: { destructiveHint: false },
  },
  async (input) =>
    write(
      input.expectedRevision,
      (w) =>
        saveSelection(
          w,
          input,
          "capture-" +
            createHash("sha256")
              .update(input.mutationId)
              .digest("hex")
              .slice(0, 32),
        ),
      input.mutationId,
    ),
);
server.registerTool(
  "create_tasks",
  {
    description:
      "Save selected next actions to a permitted page as a checklist or to a selected database as rows. Requires fresh revision and retry-stable mutation UUID.",
    inputSchema: {
      parentId: idSchema,
      tasks: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
      expectedRevision: z.number().int().nonnegative(),
      mutationId: z.string().uuid(),
    },
    annotations: { destructiveHint: false },
  },
  async ({ parentId, tasks, expectedRevision, mutationId }) =>
    write(
      expectedRevision,
      (w) => {
        const parent = w.pages.find((p) => p.id === parentId && !p.deletedAt);
        if (!parent) throw new Error("Destination not found");
        allowed(parentId);
        if (parent.kind === "database") {
          const ids: string[] = [];
          tasks.forEach((task, i) => {
            const p = newPage(task, parentId);
            p.id =
              "task-" +
              createHash("sha256")
                .update(mutationId + ":" + i)
                .digest("hex")
                .slice(0, 32);
            w.pages.push(p);
            ids.push(p.id);
          });
          return { ids };
        }
        parent.content.content = [
          ...(parent.content.content || []),
          {
            type: "taskList",
            content: tasks.map((text) => ({
              type: "taskItem",
              attrs: { checked: false },
              content: [
                { type: "paragraph", content: [{ type: "text", text }] },
              ],
            })),
          },
        ];
        parent.updatedAt = now();
        return { id: parentId, count: tasks.length };
      },
      mutationId,
    ),
);
await server.connect(new StdioServerTransport());
