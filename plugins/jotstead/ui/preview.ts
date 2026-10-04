import { App } from "@modelcontextprotocol/ext-apps";
type Data = {
  revision: number;
  pages: { id: string; title: string }[];
  page: {
    id: string;
    kind: "page" | "database";
    title: string;
    text: string;
    sharedBrief?: Record<string, string>;
    tasks: { id: string; title: string }[];
  } | null;
};
const app = new App(
  { name: "Jotstead project companion", version: "1.1.0" },
  {},
);
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let current: Data | null = null,
  busy = false;
const status = (text: string) => {
  element("status").textContent = text;
};
const error = (text: string) => {
  element("error").textContent = text;
};
function render(value: unknown) {
  const d = value as Data;
  if (!d || !Array.isArray(d.pages) || typeof d.revision !== "number") return;
  current = d;
  const select = element<HTMLSelectElement>("pages");
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a shared page";
  select.append(placeholder);
  for (const p of d.pages) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.title || "Untitled";
    select.append(o);
  }
  select.value = d.page?.id || "";
  element("title").textContent = d.page?.title || "Your shared workspace";
  element("body").textContent = d.page
    ? d.page.text || "This page has no note text yet."
    : "Choose a page to preview it beside this conversation. Only pages you selected in Jotstead Settings are available.";
  const brief = element("brief");
  brief.replaceChildren();
  brief.hidden = !d.page?.sharedBrief;
  if (d.page?.sharedBrief) {
    const h = document.createElement("h3");
    h.textContent = "Shared project brief";
    brief.append(h);
    for (const [key, title] of Object.entries({
      goals: "Goals",
      preferences: "Preferences",
      decisions: "Decisions",
      nextActions: "Next actions",
    })) {
      const label = document.createElement("strong"),
        p = document.createElement("p");
      label.textContent = title;
      p.textContent = d.page.sharedBrief[key] || "Not set";
      brief.append(label, p);
    }
  }
  const tasks = element("tasks");
  tasks.replaceChildren();
  tasks.hidden = !d.page?.tasks.length;
  for (const t of d.page?.tasks || []) {
    const p = document.createElement("p");
    p.textContent = t.title;
    tasks.append(p);
  }
  element<HTMLButtonElement>("save").disabled = !d.page;
  element<HTMLButtonElement>("save").textContent =
    d.page?.kind === "database"
      ? "Create a page in this database"
      : "Append to selected page";
  status(`Revision ${d.revision} · ${d.pages.length} selected pages`);
}
async function tool(name: string, args: Record<string, unknown>) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError)
    throw new Error(
      result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(" ") || "Tool request failed",
    );
  return result;
}
async function refresh() {
  if (busy) return;
  const id = element<HTMLSelectElement>("pages").value;
  error("");
  try {
    const r = await tool(
      id ? "preview_page" : "open_jotstead",
      id ? { id } : {},
    );
    render(r.structuredContent);
  } catch (e) {
    error((e as Error).message);
  }
}
app.ontoolresult = (result) => render(result.structuredContent);
element("pages").addEventListener("change", () => void refresh());
element("refresh").addEventListener("click", () => void refresh());
element("save").addEventListener("click", async () => {
  if (busy || !current?.page) return;
  const markdown = element<HTMLTextAreaElement>("capture").value.trim(),
    source = element<HTMLInputElement>("source").value.trim();
  if (!markdown) {
    error("Paste selected content before saving.");
    return;
  }
  busy = true;
  element<HTMLButtonElement>("save").disabled = true;
  error("");
  status("Saving selected content…");
  try {
    await tool("save_to_jotstead", {
      ...(current.page.kind === "database"
        ? { mode: "create", parentId: current.page.id }
        : { mode: "append", pageId: current.page.id }),
      markdown,
      title: "Saved from ChatGPT",
      sourceChatUrl: source || undefined,
      expectedRevision: current.revision,
      mutationId: crypto.randomUUID(),
    });
    element<HTMLTextAreaElement>("capture").value = "";
    busy = false;
    await refresh();
    status(
      "Selection saved. Refresh Jotstead to see the latest page. Newly created pages need their own permission in Settings to be read by the plugin.",
    );
  } catch (e) {
    error((e as Error).message);
  } finally {
    busy = false;
    element<HTMLButtonElement>("save").disabled = !current?.page;
  }
});
app
  .connect()
  .then(() => status("Connected. Choose a selected page."))
  .catch(() =>
    error(
      "This view requires a host with MCP Apps support. The plugin's tools also work without this panel.",
    ),
  );
