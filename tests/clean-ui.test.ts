// @vitest-environment happy-dom
import React from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Sidebar } from "../src/features/workspace/sidebar";
import { Menu } from "../src/components/ui";
import { PropertyCell } from "../src/features/databases/property-cell";
import { labelOf } from "../src/features/databases/query";
import { createSeed } from "../src/lib/seed";
afterEach(cleanup);
it("Home navigates to a workspace destination separate from Getting started", () => {
  const open = vi.fn();
  const w = createSeed();
  const ui = render(
    React.createElement(Sidebar, {
      workspace: w,
      active: "workspace-home",
      open,
      create: vi.fn(),
      onSearch: vi.fn(),
      onSettings: vi.fn(),
      onTemplates: vi.fn(),
      onTrash: vi.fn(),
      onClose: vi.fn(),
      onPageMenu: vi.fn(),
      onMove: vi.fn(),
    }),
  );
  fireEvent.click(ui.getByRole("button", { name: "Home" }));
  expect(open).toHaveBeenCalledWith("workspace-home");
  expect(ui.queryByRole("button", { name: "Expand Projects" })).toBeNull();
  expect(ui.getAllByRole("button", { name: "New page" })).toHaveLength(1);
});
it("keyboard menus move focus and dismiss on Escape", () => {
  const close = vi.fn();
  const ui = render(
    React.createElement(Menu, {
      onClose: close,
      children: [
        React.createElement("button", { key: "one" }, "One"),
        React.createElement("button", { key: "two" }, "Two"),
      ],
    }),
  );
  fireEvent.keyDown(ui.getByText("One"), { key: "ArrowDown" });
  expect(document.activeElement).toBe(ui.getByText("Two"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});
it("multiple tags can be typed before committing", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  const row = w.pages.find((p) => p.parentId === db.id)!;
  row.values.tags = [];
  const onChange = vi.fn();
  const prop = db.properties.find((p) => p.id === "tags")!;
  const ui = render(
    React.createElement(PropertyCell, {
      workspace: w,
      db,
      row,
      property: prop,
      onChange,
    }),
  );
  const input = ui.getByLabelText("Tags");
  fireEvent.change(input, { target: { value: "Design, Writing" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledWith(["Design", "Writing"]);
});
it("dates have one readable timezone-safe presentation", () => {
  const w = createSeed();
  expect(labelOf("2026-10-06", w, "date")).toBe("6 Oct 2026");
  expect(labelOf("", w, "date")).toBe("");
  expect(labelOf("not a date", w, "date")).toBe("not a date");
});
import { Database } from "../src/features/databases/database";
import { validateWorkspace } from "../src/lib/model";
it("keeps secondary views accessible in a picker", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  const ui = render(
    React.createElement(Database, {
      page: db,
      workspace: w,
      update: vi.fn(),
      onOpen: vi.fn(),
    }),
  );
  expect(ui.queryByRole("button", { name: "Gallery" })).toBeNull();
  fireEvent.click(ui.getByRole("button", { name: "More views" }));
  fireEvent.click(ui.getByRole("button", { name: "Gallery" }));
  expect(
    ui.getByRole("button", { name: "Gallery" }).getAttribute("aria-current"),
  ).toBe("page");
});
it("hides chosen table properties without deleting their data", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  const table = db.views[0];
  Object.assign(table, { hiddenProperties: ["priority"] });
  const parsed = validateWorkspace(w);
  expect(
    (
      parsed.pages.find((p) => p.id === "projects")!
        .views[0] as typeof table & { hiddenProperties: string[] }
    ).hiddenProperties,
  ).toEqual(["priority"]);
  const ui = render(
    React.createElement(Database, {
      page: db,
      workspace: w,
      update: vi.fn(),
      onOpen: vi.fn(),
    }),
  );
  expect(ui.queryByRole("columnheader", { name: "Priority" })).toBeNull();
  expect(ui.getByRole("columnheader", { name: "Status" })).toBeTruthy();
});
it("board cards do not repeat the grouping status", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  db.views = [db.views.find((v) => v.type === "board")!];
  const ui = render(
    React.createElement(Database, {
      page: db,
      workspace: w,
      update: vi.fn(),
      onOpen: vi.fn(),
    }),
  );
  const first = w.pages.find((p) => p.parentId === db.id)!;
  const card = ui.getByRole("button", { name: new RegExp(first.title) });
  expect(card.textContent).not.toContain(String(first.values.status));
  expect(
    ui.queryByRole("button", { name: "Add page to In progress" }),
  ).toBeNull();
});
it("fresh project examples have one editable completion source", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  expect(
    db.properties.filter((p) => p.type === "checkbox" && p.name === "Complete"),
  ).toHaveLength(0);
  expect(db.properties.find((p) => p.id === "status")?.options).toContain(
    "Done",
  );
});
it("Escape dismisses the top menu without closing its parent dialog", () => {
  const parent = vi.fn();
  document.addEventListener("keydown", parent);
  const close = vi.fn();
  render(
    React.createElement(Menu, {
      onClose: close,
      children: React.createElement("button", null, "Action"),
    }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  expect(parent).not.toHaveBeenCalled();
  document.removeEventListener("keydown", parent);
});
it("an unfocused menu still dismisses on an outside pointer", () => {
  const close = vi.fn();
  const ui = render(
    React.createElement(Menu, {
      onClose: close,
      children: React.createElement("button", null, "Action"),
    }),
  );
  fireEvent.pointerDown(document.body);
  expect(close).toHaveBeenCalledOnce();
});
import { PageIcon } from "../src/components/ui";
it("presents existing page emoji as matching monochrome vectors", () => {
  const ui = render(React.createElement(PageIcon, { icon: "🗂️", size: 28 }));
  expect(ui.container.querySelector("svg")).toBeTruthy();
  expect(ui.container.textContent).not.toContain("🗂️");
});
it("renders persisted named icons and handles unknown icons without exposing internal IDs", () => {
  const ui = render(
    React.createElement(PageIcon, { icon: "icon:house", size: 28 }),
  );
  expect(ui.container.querySelector("svg")).toBeTruthy();
  ui.rerender(React.createElement(PageIcon, { icon: "icon:future-icon" }));
  expect(ui.container.textContent).not.toContain("icon:");
  expect(ui.container.querySelector("svg")).toBeTruthy();
});
it("commits date input events even when the native control updates its value first", () => {
  const w = createSeed();
  const db = w.pages.find((p) => p.id === "projects")!;
  const row = w.pages.find((p) => p.parentId === db.id)!;
  const property = db.properties.find((p) => p.id === "date")!;
  const onChange = vi.fn();
  const ui = render(
    React.createElement(PropertyCell, {
      workspace: w,
      db,
      row,
      property,
      onChange,
    }),
  );
  fireEvent.click(ui.getByRole("button", { name: "Due date" }));
  const input = ui.getByLabelText("Due date") as HTMLInputElement;
  input.value = "2026-10-16";
  fireEvent.input(input);
  expect(onChange).toHaveBeenCalledWith("2026-10-16");
});
