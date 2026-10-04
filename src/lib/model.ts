import { z } from "zod";

export const MAX_WORKSPACE_BYTES = 5 * 1024 * 1024;
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const propertyTypes = [
  "text",
  "number",
  "select",
  "multiSelect",
  "date",
  "checkbox",
  "url",
  "relation",
  "formula",
  "rollup",
] as const;
export const viewTypes = [
  "table",
  "board",
  "gallery",
  "list",
  "calendar",
  "timeline",
  "chart",
] as const;
export type Doc = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Doc[];
};
export type Value = string | number | boolean | string[] | null;
const valueSchema = z.union([
  z.string().max(10000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(10000)).max(2000),
  z.null(),
]);
const propertySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  type: z.enum(propertyTypes),
  options: z.array(z.string().max(80)).max(100).optional(),
  expression: z.string().max(500).optional(),
  targetId: idSchema.optional(),
  relationId: idSchema.optional(),
  rollupId: idSchema.optional(),
  aggregate: z.enum(["count", "sum", "average"]).optional(),
});
export type Property = z.infer<typeof propertySchema>;
const filterSchema = z.object({
  propertyId: z.string().max(80),
  operator: z.enum([
    "contains",
    "equals",
    "not",
    "empty",
    "before",
    "after",
    "gt",
    "lt",
  ]),
  value: z.string().max(2000),
});
export type Filter = z.infer<typeof filterSchema>;
const viewSchema = z.object({
  id: idSchema,
  name: z.string().max(80),
  type: z.enum(viewTypes),
  filters: z.array(filterSchema).max(20),
  sort: z
    .object({
      propertyId: z.string().max(80),
      direction: z.enum(["asc", "desc"]),
    })
    .nullable(),
  groupBy: z.string().max(80).nullable(),
  dateProperty: z.string().max(80).nullable(),
});
export type View = z.infer<typeof viewSchema>;
const pageSchema = z.object({
  id: idSchema,
  parentId: idSchema.nullable(),
  title: z.string().max(500),
  icon: z.string().max(24),
  cover: z.string().max(2000).nullable(),
  kind: z.enum(["page", "database"]),
  content: z.unknown(),
  favorite: z.boolean(),
  fullWidth: z.boolean(),
  smallText: z.boolean(),
  font: z.enum(["default", "serif", "mono"]),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  properties: z.array(propertySchema).max(100),
  values: z.record(z.string(), valueSchema),
  views: z.array(viewSchema).max(30),
  published: z.boolean(),
  formEnabled: z.boolean(),
  comments: z
    .array(
      z.object({
        id: idSchema,
        text: z.string().max(10000),
        createdAt: z.string(),
        blockId: z.string().max(80).nullable(),
      }),
    )
    .max(1000),
});
export type Page = Omit<z.infer<typeof pageSchema>, "content"> & {
  content: Doc;
};
const ruleSchema = z.object({
  id: idSchema,
  databaseId: idSchema,
  name: z.string().max(80),
  whenProperty: idSchema,
  whenValue: z.string().max(200),
  setProperty: idSchema,
  setValue: valueSchema,
  enabled: z.boolean(),
});
export type Rule = z.infer<typeof ruleSchema>;
const workspaceSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  pages: z.array(pageSchema).max(2000),
  rules: z.array(ruleSchema).max(100),
});
export type Workspace = {
  version: 1;
  name: string;
  pages: Page[];
  rules: Rule[];
};
export type Snapshot = { revision: number; data: Workspace };
export const blankDoc = (): Doc => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export function newPage(
  title = "Untitled",
  parentId: string | null = null,
  kind: Page["kind"] = "page",
): Page {
  return {
    id: uid(),
    parentId,
    title,
    icon: "",
    cover: null,
    kind,
    content: blankDoc(),
    favorite: false,
    fullWidth: kind === "database",
    smallText: false,
    font: "default",
    deletedAt: null,
    createdAt: now(),
    updatedAt: now(),
    properties: [],
    values: {},
    views: kind === "database" ? [makeView("table")] : [],
    published: false,
    formEnabled: false,
    comments: [],
  };
}
export function makeView(type: View["type"]): View {
  return {
    id: uid(),
    name: type[0].toUpperCase() + type.slice(1),
    type,
    filters: [],
    sort: null,
    groupBy: null,
    dateProperty: null,
  };
}
export function safeUrl(value: string): boolean {
  return (
    /^(https?:\/\/|mailto:)/i.test(value) ||
    /^\/api\/uploads\/[a-zA-Z0-9_-]+$/.test(value) ||
    /^\/\?page=[a-zA-Z0-9_-]+$/.test(value)
  );
}
const nodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "details",
  "detailsSummary",
  "detailsContent",
  "callout",
  "columns",
  "column",
  "file",
  "pageLink",
]);
const markTypes = new Set([
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "link",
  "textStyle",
  "highlight",
]);
function validateDoc(input: unknown, depth = 0): Doc {
  if (depth > 32 || !input || typeof input !== "object")
    throw new Error("Document exceeds supported depth or structure");
  const n = input as Doc;
  if (!nodeTypes.has(n.type) || (n.text && typeof n.text !== "string"))
    throw new Error("Unsupported document node");
  if (n.content && !Array.isArray(n.content))
    throw new Error("Invalid document content");
  // Normalize legacy empty text nodes; ProseMirror represents an empty paragraph with no text child.
  if (n.content)
    n.content = n.content.filter((c) => !(c.type === "text" && c.text === ""));
  const children = n.content || [];
  const inlineTypes = new Set(["text", "hardBreak"]);
  const blocks = new Set([
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "image",
    "table",
    "details",
    "callout",
    "columns",
    "file",
    "pageLink",
  ]);
  let allowed: Set<string> | undefined;
  if (
    [
      "doc",
      "listItem",
      "taskItem",
      "blockquote",
      "callout",
      "column",
      "detailsContent",
      "tableCell",
      "tableHeader",
    ].includes(n.type)
  )
    allowed = blocks;
  if (["paragraph", "heading", "detailsSummary"].includes(n.type))
    allowed = inlineTypes;
  if (n.type === "codeBlock") allowed = new Set(["text"]);
  if (["bulletList", "orderedList"].includes(n.type))
    allowed = new Set(["listItem"]);
  if (n.type === "taskList") allowed = new Set(["taskItem"]);
  if (n.type === "columns") allowed = new Set(["column"]);
  if (n.type === "table") allowed = new Set(["tableRow"]);
  if (n.type === "tableRow") allowed = new Set(["tableCell", "tableHeader"]);
  if (
    n.type === "details" &&
    (children.length !== 2 ||
      children[0]?.type !== "detailsSummary" ||
      children[1]?.type !== "detailsContent")
  )
    throw new Error("Invalid toggle structure");
  if (allowed && children.some((c) => !allowed!.has(c.type)))
    throw new Error("Invalid document structure");
  if (
    [
      "text",
      "hardBreak",
      "horizontalRule",
      "image",
      "file",
      "pageLink",
    ].includes(n.type) &&
    children.length
  )
    throw new Error("Invalid leaf structure");
  if (n.type === "text" && (typeof n.text !== "string" || !n.text.length))
    throw new Error("Invalid text structure");
  if (n.type === "heading" && ![1, 2, 3].includes(Number(n.attrs?.level)))
    throw new Error("Invalid heading level");
  if (n.type === "doc" && depth !== 0)
    throw new Error("Invalid document root structure");
  if (
    ["listItem", "taskItem"].includes(n.type) &&
    children[0]?.type !== "paragraph"
  )
    throw new Error("Invalid list item structure");
  if (
    [
      "blockquote",
      "callout",
      "column",
      "detailsContent",
      "tableCell",
      "tableHeader",
      "listItem",
      "taskItem",
    ].includes(n.type) &&
    !children.length
  )
    throw new Error("Empty block structure");
  if (
    ["bulletList", "orderedList", "taskList", "table", "tableRow"].includes(
      n.type,
    ) &&
    !children.length
  )
    throw new Error("Empty list/table structure");
  if (n.type === "columns" && (children.length < 2 || children.length > 3))
    throw new Error("Invalid column structure");
  if (
    n.type === "table" &&
    (children.length > 1000 ||
      children.some(
        (r) =>
          (r.content || []).reduce(
            (sum, c) => sum + Number(c.attrs?.colspan || 1),
            0,
          ) > 100,
      ))
  )
    throw new Error("Table exceeds supported dimensions");
  if (["tableCell", "tableHeader"].includes(n.type)) {
    for (const key of ["colspan", "rowspan"]) {
      const v = n.attrs?.[key];
      if (
        v != null &&
        (typeof v !== "number" ||
          !Number.isInteger(v) ||
          v < 1 ||
          v > (key === "colspan" ? 100 : 1000))
      )
        throw new Error("Invalid table span");
    }
    const widths = n.attrs?.colwidth;
    if (
      widths != null &&
      (!Array.isArray(widths) ||
        widths.length !== Number(n.attrs?.colspan || 1) ||
        widths.some(
          (v) =>
            typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 4000,
        ))
    )
      throw new Error("Invalid table column width");
  }
  if (n.attrs) {
    if (typeof n.attrs !== "object" || Array.isArray(n.attrs))
      throw new Error("Invalid node attributes");
    for (const [k, v] of Object.entries(n.attrs)) {
      if (
        ![
          "id",
          "level",
          "start",
          "checked",
          "language",
          "src",
          "alt",
          "title",
          "width",
          "height",
          "colspan",
          "rowspan",
          "colwidth",
          "open",
          "color",
          "pageId",
          "name",
          "size",
          "icon",
        ].includes(k)
      )
        throw new Error("Unsupported node attribute");
      if (["src"].includes(k) && v && !safeUrl(String(v)))
        throw new Error("Unsafe document URL");
    }
  }
  if (n.marks) {
    if (!Array.isArray(n.marks)) throw new Error("Invalid marks");
    for (const m of n.marks) {
      if (!markTypes.has(m.type)) throw new Error("Unsupported mark");
      if (m.type === "link" && m.attrs?.href && !safeUrl(String(m.attrs.href)))
        throw new Error("Unsafe link");
      if (m.attrs)
        for (const [k, v] of Object.entries(m.attrs)) {
          if (
            ![
              "href",
              "target",
              "rel",
              "class",
              "color",
              "backgroundColor",
              "fontSize",
              "fontFamily",
              "lineHeight",
            ].includes(k)
          )
            throw new Error("Unsupported mark attribute");
          if (
            ["color", "backgroundColor"].includes(k) &&
            v &&
            !/^(#[a-fA-F0-9]{3,8}|[a-zA-Z]{1,20}|rgba?\([\d\s,.%]+\))$/.test(
              String(v),
            )
          )
            throw new Error("Invalid color");
        }
    }
  }
  if (n.content) {
    if (!Array.isArray(n.content) || n.content.length > 20000)
      throw new Error("Invalid document content");
    n.content.forEach((c) => validateDoc(c, depth + 1));
  }
  return n;
}
export function validateWorkspace(input: unknown): Workspace {
  const parsed = workspaceSchema.parse(input);
  const w = parsed as Workspace;
  const byId = new Map(w.pages.map((p) => [p.id, p]));
  if (byId.size !== w.pages.length) throw new Error("Duplicate page IDs");
  for (const p of w.pages) {
    validateDoc(p.content);
    if (p.content.type !== "doc") throw new Error("Document root required");
    if (p.parentId && !byId.has(p.parentId)) throw new Error("Missing parent");
    if (
      p.cover &&
      !safeUrl(p.cover) &&
      !/^color:#[a-fA-F0-9]{6}$/.test(p.cover)
    )
      throw new Error("Unsafe cover URL");
    let cursor: Page | undefined = p;
    const visited = new Set<string>();
    while (cursor) {
      if (visited.has(cursor.id)) throw new Error("Page tree cycle");
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    const ids = new Set(p.properties.map((v) => v.id));
    if (ids.size !== p.properties.length) throw new Error("Duplicate property");
    if (new Set(p.views.map((v) => v.id)).size !== p.views.length)
      throw new Error("Duplicate view");
    const db = p.parentId ? byId.get(p.parentId) : undefined;
    if (db?.kind === "database")
      for (const prop of db.properties) {
        const v = p.values[prop.id];
        if (v == null) continue;
        const ok =
          prop.type === "number"
            ? typeof v === "number"
            : prop.type === "checkbox"
              ? typeof v === "boolean"
              : ["multiSelect", "relation"].includes(prop.type)
                ? Array.isArray(v)
                : typeof v === "string";
        if (!ok) throw new Error(`Invalid value for ${prop.name}`);
        if (
          prop.type === "date" &&
          v !== "" &&
          !/^\d{4}-\d{2}-\d{2}$/.test(String(v))
        )
          throw new Error("Invalid date");
        if (
          prop.type === "relation" &&
          Array.isArray(v) &&
          v.some((id) => !byId.has(id))
        )
          throw new Error("Missing related page");
      }
  }
  if (
    new TextEncoder().encode(JSON.stringify(w)).byteLength > MAX_WORKSPACE_BYTES
  )
    throw new Error(
      "Workspace exceeds the 5 MiB storage limit. Export and split large content into a separate workspace.",
    );
  return w;
}
export function descendants(w: Workspace, id: string): string[] {
  const result: string[] = [];
  const visit = (parent: string) => {
    for (const p of w.pages.filter((p) => p.parentId === parent)) {
      result.push(p.id);
      visit(p.id);
    }
  };
  visit(id);
  return result;
}
export function movePage(w: Workspace, id: string, parentId: string | null) {
  if (id === parentId || (parentId && descendants(w, id).includes(parentId)))
    throw new Error("Cannot move a page into its descendant");
  const p = w.pages.find((p) => p.id === id);
  if (!p) throw new Error("Page not found");
  p.parentId = parentId;
  p.updatedAt = now();
}
export function trashPage(w: Workspace, id: string, restore = false) {
  for (const p of w.pages.filter((p) =>
    [id, ...descendants(w, id)].includes(p.id),
  )) {
    p.deletedAt = restore ? null : now();
    p.updatedAt = now();
    if (!restore) {
      p.published = false;
      p.formEnabled = false;
    }
  }
}
export function textOf(doc: Doc): string {
  return [doc.text || "", ...(doc.content || []).map(textOf)]
    .filter(Boolean)
    .join(" ");
}
export function livePages(w: Workspace) {
  return w.pages.filter((p) => !p.deletedAt);
}
export function publicProjection(page: Page) {
  return {
    id: page.id,
    title: page.title,
    icon: page.icon,
    cover: page.cover,
    content: page.content,
    font: page.font,
    fullWidth: page.fullWidth,
    smallText: page.smallText,
  };
}
