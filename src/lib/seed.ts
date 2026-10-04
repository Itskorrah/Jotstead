import {
  newPage,
  makeView,
  type Doc,
  type Workspace,
  type Page,
} from "./model";
const text = (t: string): Doc => ({ type: "text", text: t });
const p = (t: string): Doc => ({
  type: "paragraph",
  content: t ? [text(t)] : [],
});
const h = (t: string, level = 2): Doc => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});
const todo = (t: string, checked = false): Doc => ({
  type: "taskItem",
  attrs: { checked },
  content: [p(t)],
});
const doc = (content: Doc[]): Doc => ({ type: "doc", content });
function page(
  id: string,
  title: string,
  icon: string,
  parentId: string | null = null,
): Page {
  return { ...newPage(title, parentId), id, icon };
}
export function createSeed(): Workspace {
  const home = page("home", "Getting started", "👋");
  home.favorite = true;
  home.content = doc([
    p(
      "Welcome to Jotstead. A home for your ideas, projects, and everything in between.",
    ),
    {
      type: "callout",
      attrs: { color: "gray" },
      content: [
        p(
          "Your workspace is yours. Start writing, or press / to add a block. Every change is saved automatically.",
        ),
      ],
    },
    h("Make yourself at home"),
    {
      type: "taskList",
      content: [
        todo("Make a page and give it a name"),
        todo("Try a slash command by typing /"),
        todo("Explore your Projects database"),
      ],
    },
    h("A little room to think"),
    p(
      "Use pages for notes. Use databases for anything you want to organize. Drag pages in the sidebar to nest them, and star the ones you come back to.",
    ),
    {
      type: "pageLink",
      attrs: { pageId: "guide", title: "Writing & organizing", icon: "📖" },
    },
    {
      type: "pageLink",
      attrs: { pageId: "projects", title: "Projects", icon: "🗂️" },
    },
    h("One place. All your devices."),
    p(
      "Install Jotstead from your browser to use it like an app. Your pages live on your server, and drafts stay on this device if the connection drops.",
    ),
  ]);
  const guide = page("guide", "Writing & organizing", "📖", "home");
  guide.content = doc([
    h("Start with a blank page"),
    p(
      "Click New page in the sidebar. Type a title, then start writing below it.",
    ),
    h("Build with blocks"),
    p(
      "Type / for text, headings, to-dos, toggles, callouts, images, files, tables, and more. Markdown shortcuts work too: # for a heading, - for a list, and [] for a task.",
    ),
    {
      type: "details",
      attrs: { open: true },
      content: [
        { type: "detailsSummary", content: [text("Keyboard shortcuts")] },
        {
          type: "detailsContent",
          content: [
            p("⌘/Ctrl + K — Search your workspace"),
            p("⌘/Ctrl + N — New page"),
            p("⌘/Ctrl + B / I / U — Bold, italic, underline"),
            p("⌘/Ctrl + Z — Undo"),
            p("Escape — Close menus"),
          ],
        },
      ],
    },
    h("Make it yours"),
    p(
      "Add an icon or cover above a page. The page menu includes fonts, small text, full width, history, export, and moving pages.",
    ),
    h("Keep a copy"),
    p(
      "Export the full workspace from Settings. Back up your server’s data folder with the included backup command.",
    ),
  ]);
  const tasks = page("todos", "Personal To-dos", "👜");
  tasks.favorite = true;
  tasks.content = doc([
    h("Today"),
    {
      type: "taskList",
      content: [
        todo("Choose a direction for the project"),
        todo("Review the first draft"),
        todo("Make time for a walk"),
      ],
    },
    h("This week"),
    {
      type: "taskList",
      content: [
        todo("Organize ideas into a few pages"),
        todo("Plan the next small step"),
      ],
    },
    h("Someday"),
    p("A little space for the things you haven’t made time for yet."),
  ]);
  const notes = page("notes", "Notes", "📝");
  notes.content = doc([
    p("Good ideas deserve a place to land."),
    h("Thoughts & ideas"),
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [p("Keep things simple.")] },
        {
          type: "listItem",
          content: [p("Make room for a fresh perspective.")],
        },
      ],
    },
  ]);
  const db = page("projects", "Projects", "🗂️");
  db.kind = "database";
  db.fullWidth = true;
  db.favorite = true;
  db.properties = [
    {
      id: "status",
      name: "Status",
      type: "select",
      options: ["Not started", "In progress", "Done"],
    },
    {
      id: "priority",
      name: "Priority",
      type: "select",
      options: ["High", "Medium", "Low"],
    },
    { id: "date", name: "Due date", type: "date" },
    {
      id: "tags",
      name: "Tags",
      type: "multiSelect",
      options: ["Design", "Writing", "Personal"],
    },
    { id: "effort", name: "Effort (points)", type: "number" },
  ];
  db.views = [
    "table",
    "board",
    "gallery",
    "list",
    "calendar",
    "timeline",
    "chart",
  ].map((type) => ({
    ...makeView(type as "table"),
    name: {
      table: "All projects",
      board: "By status",
      gallery: "Gallery",
      list: "List",
      calendar: "Calendar",
      timeline: "Timeline",
      chart: "Overview",
    }[type]!,
    groupBy: "status",
    dateProperty: "date",
  }));
  const titles = [
    "Build a home for ideas",
    "Plan the next chapter",
    "Collect visual inspiration",
    "A small weekend project",
    "Write something worth keeping",
    "Clear the desk",
  ];
  const rows = titles.map((title, i) => {
    const row = page(
      `task-${i + 1}`,
      title,
      ["🏡", "📅", "🎨", "🌱", "✍️", "☕"][i],
      "projects",
    );
    row.values = {
      status: [
        "In progress",
        "Not started",
        "In progress",
        "Not started",
        "Done",
        "Done",
      ][i],
      priority: ["High", "Medium", "High", "Low", "Medium", "Low"][i],
      date: `2026-10-${String(i + 5).padStart(2, "0")}`,
      tags: [
        ["Design"],
        ["Personal"],
        ["Design"],
        ["Personal"],
        ["Writing"],
        ["Personal"],
      ][i],
      effort: i + 1,
    };
    row.content = doc([
      p("Start with a small, clear next step."),
      h("Notes"),
      p("Add details, ideas, and anything you need to move this forward."),
    ]);
    return row;
  });
  const journal = page("journal", "Daily journal", "🌤️");
  journal.content = doc([
    h("A fresh start"),
    p("What’s on your mind today?"),
    {
      type: "blockquote",
      content: [p("The secret of getting ahead is getting started.")],
    },
    h("One thing to remember"),
    p(""),
  ]);
  return {
    version: 1,
    name: "Jotstead",
    pages: [home, guide, tasks, db, notes, journal, ...rows],
    rules: [],
  };
}
