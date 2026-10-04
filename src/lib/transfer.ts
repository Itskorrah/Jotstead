import {
  type Workspace,
  type Page,
  type Doc,
  newPage,
  validateWorkspace,
  textOf,
} from "./model";
import { propertyValue, labelOf } from "@/features/databases/query";
function inline(n: Doc): string {
  if (n.type === "text") {
    let s = n.text || "";
    for (const m of n.marks || []) {
      if (m.type === "bold") s = `**${s}**`;
      if (m.type === "italic") s = `*${s}*`;
      if (m.type === "code") s = "`" + s + "`";
      if (m.type === "strike") s = `~~${s}~~`;
      if (m.type === "link") s = `[${s}](${m.attrs?.href || ""})`;
    }
    return s;
  }
  if (n.type === "hardBreak") return "\n";
  return (n.content || []).map(inline).join("");
}
export function markdownExport(page: Page) {
  const render = (n: Doc, depth = 0): string => {
    switch (n.type) {
      case "heading":
        return (
          "#".repeat(Number(n.attrs?.level) || 1) + " " + inline(n) + "\n\n"
        );
      case "paragraph":
        return inline(n) + "\n\n";
      case "bulletList":
      case "orderedList":
      case "taskList":
        return (
          (n.content || [])
            .map(
              (c, i) =>
                "  ".repeat(depth) +
                (n.type === "orderedList"
                  ? `${i + 1}. `
                  : n.type === "taskList"
                    ? `- [${c.attrs?.checked ? "x" : " "}] `
                    : "- ") +
                (c.content || [])
                  .map((child, j) =>
                    j === 0 ? inline(child) : "\n" + render(child, depth + 1),
                  )
                  .join(""),
            )
            .join("\n") + "\n\n"
        );
      case "blockquote":
      case "callout":
        return (
          (n.content || []).map((c) => "> " + inline(c)).join("\n") + "\n\n"
        );
      case "codeBlock":
        return (
          "```" +
          String(n.attrs?.language || "") +
          "\n" +
          inline(n) +
          "\n```\n\n"
        );
      case "horizontalRule":
        return "---\n\n";
      case "image":
        return `![${n.attrs?.alt || ""}](${n.attrs?.src})\n\n`;
      case "file":
        return `[${n.attrs?.name}](${n.attrs?.src})\n\n`;
      case "pageLink":
        return `[${n.attrs?.title}](/?page=${n.attrs?.pageId})\n\n`;
      case "details":
        return `<details>\n<summary>${inline(n.content?.[0] || { type: "paragraph" })}</summary>\n\n${(n.content?.[1]?.content || []).map((c) => render(c, depth)).join("")}</details>\n\n`;
      case "table":
        return (
          (n.content || [])
            .map(
              (r, i) =>
                "| " +
                (r.content || [])
                  .map((c) => inline(c).replace(/\|/g, "\\|"))
                  .join(" | ") +
                " |\n" +
                (i === 0
                  ? "| " +
                    (r.content || []).map(() => "---").join(" | ") +
                    " |\n"
                  : ""),
            )
            .join("") + "\n"
        );
      default:
        return (n.content || []).map((c) => render(c, depth)).join("");
    }
  };
  return "# " + page.title + "\n\n" + render(page.content);
}
const escapeCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return '"' + safe.replaceAll('"', '""') + '"';
};
export function csvExport(w: Workspace, db: Page) {
  return [
    ["Name", ...db.properties.map((p) => p.name)],
    ...w.pages
      .filter((p) => p.parentId === db.id && !p.deletedAt)
      .map((row) => [
        row.title,
        ...db.properties.map((p) =>
          labelOf(propertyValue(w, db, row, p.id), w, p.type),
        ),
      ]),
  ]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}
export function parseCsv(value: string): string[][] {
  if (new TextEncoder().encode(value).byteLength > 6 * 1024 * 1024)
    throw new Error("CSV is too large");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (cell === "" || quoted) quoted = !quoted;
      else cell += c;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && value[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field");
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
export function importCsv(value: string, title: string): Page[] {
  const [headers, ...rows] = parseCsv(value);
  if (!headers?.length || headers.length > 101)
    throw new Error("CSV requires a header and at most 100 properties");
  if (rows.length > 1998) throw new Error("CSV has too many rows");
  const db = newPage(title, null, "database");
  db.properties = headers.slice(1).map((name, i) => ({
    id: `property-${i}`,
    name: name.trim().slice(0, 80) || `Property ${i + 1}`,
    type: "text" as const,
  }));
  return [
    db,
    ...rows.map((values) => {
      const row = newPage(values[0] || "Untitled", db.id);
      row.values = Object.fromEntries(
        db.properties.map((p, i) => [p.id, values[i + 1] || ""]),
      );
      return row;
    }),
  ];
}
export function importMarkdown(
  value: string,
  title: string,
  options: { extractTitle?: boolean } = {},
): Page {
  const page = newPage(title);
  const content: Doc[] = [];
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  let code: string[] | null = null;
  let lang = "";
  let usedTitle = false;
  const paragraph = (text: string): Doc => ({
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  });
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (code) {
        content.push({
          type: "codeBlock",
          attrs: { language: lang || null },
          content: code.length ? [{ type: "text", text: code.join("\n") }] : [],
        });
        code = null;
      } else {
        code = [];
        lang = line.slice(3).trim();
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,3}) (.*)/);
    if (heading) {
      if (
        options.extractTitle !== false &&
        !usedTitle &&
        content.length === 0 &&
        heading[1] === "#"
      ) {
        page.title = heading[2];
        usedTitle = true;
        continue;
      }
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }
    const task = line.match(/^[-*] \[([ xX])\] (.*)/);
    const bullet = line.match(/^[-*] (.*)/);
    if (task || bullet) {
      const type = task ? "taskList" : "bulletList";
      let list = content.at(-1);
      if (list?.type !== type) {
        list = { type, content: [] };
        content.push(list);
      }
      list.content!.push(
        task
          ? {
              type: "taskItem",
              attrs: { checked: task[1].toLowerCase() === "x" },
              content: [paragraph(task[2])],
            }
          : { type: "listItem", content: [paragraph(bullet![1])] },
      );
    } else if (line === "---") content.push({ type: "horizontalRule" });
    else if (line.startsWith("> "))
      content.push({ type: "blockquote", content: [paragraph(line.slice(2))] });
    else if (line.trim()) content.push(paragraph(line));
  }
  if (code)
    content.push({
      type: "codeBlock",
      content: [{ type: "text", text: code.join("\n") }],
    });
  page.content = {
    type: "doc",
    content: content.length ? content : [paragraph("")],
  };
  return page;
}
export function parseWorkspaceExport(value: string): Workspace {
  if (new TextEncoder().encode(value).byteLength > 6 * 1024 * 1024)
    throw new Error("Workspace export is too large");
  const input = JSON.parse(value);
  return validateWorkspace(input.data || input);
}
export function workspaceExport(workspace: Workspace) {
  return JSON.stringify({
    format: "jotstead",
    exportedAt: new Date().toISOString(),
    data: workspace,
  });
}
export function referencedPages(doc: Doc): string[] {
  const refs = new Set<string>();
  const visit = (n: Doc) => {
    if (n.type === "pageLink" && n.attrs?.pageId)
      refs.add(String(n.attrs.pageId));
    for (const m of n.marks || []) {
      const href = String(m.attrs?.href || "");
      const match = href.match(/^\/\?page=([a-zA-Z0-9_-]+)/);
      if (match) refs.add(match[1]);
    }
    n.content?.forEach(visit);
  };
  visit(doc);
  return [...refs];
}
