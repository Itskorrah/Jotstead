// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { PageEditor } from "../src/features/editor/editor";
import type { Doc } from "../src/lib/model";
afterEach(cleanup);

it("live linked pages use workspace navigation without a browser reload", async () => {
  const navigate = vi.fn();
  const content: Doc = {
    type: "doc",
    content: [
      {
        type: "pageLink",
        attrs: { pageId: "notes", title: "My notes", icon: "icon:notes" },
      },
    ],
  };
  const ui = render(
    React.createElement(PageEditor, { content, onNavigate: navigate }),
  );
  const link = await ui.findByRole("link", { name: "My notes" });
  fireEvent.mouseDown(link, { clientX: 1, clientY: 1 });
  fireEvent.mouseUp(link, { clientX: 1, clientY: 1 });
  fireEvent.click(link);
  expect(navigate).toHaveBeenCalledWith("notes");
});

it("format and history controls react to stored marks, selection and undo", async () => {
  let editor: Editor | undefined;
  const content: Doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          { type: "text", text: " plain" },
        ],
      },
    ],
  };
  const ui = render(
    React.createElement(PageEditor, {
      content,
      onReady: (e: Editor) => {
        editor = e;
      },
    }),
  );
  await waitFor(() => expect(editor).toBeDefined());
  expect(
    ui.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    ui.getByRole("button", { name: "Redo" }).hasAttribute("disabled"),
  ).toBe(true);
  act(() => editor!.commands.setTextSelection(2));
  expect(
    ui.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed"),
  ).toBe("true");
  act(() => editor!.commands.setTextSelection(8));
  expect(
    ui.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed"),
  ).toBe("false");
  act(() => editor!.commands.toggleItalic());
  expect(
    ui.getByRole("button", { name: "Italic" }).getAttribute("aria-pressed"),
  ).toBe("true");
  act(() => editor!.commands.insertContent(" extra"));
  expect(
    ui.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
  ).toBe(false);
  act(() => editor!.commands.undo());
  expect(
    ui.getByRole("button", { name: "Redo" }).hasAttribute("disabled"),
  ).toBe(false);
});

it("external document changes still replace editor content after initialization", async () => {
  let editor: Editor | undefined;
  const ready = (e: Editor) => {
    editor = e;
  };
  const initial: Doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Original" }] },
    ],
  };
  const replacement: Doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Restored document" }],
      },
    ],
  };
  const ui = render(
    React.createElement(PageEditor, { content: initial, onReady: ready }),
  );
  await waitFor(() => expect(editor).toBeDefined());
  expect(editor!.getText()).toBe("Original");
  ui.rerender(
    React.createElement(PageEditor, { content: replacement, onReady: ready }),
  );
  expect(editor!.getText()).toBe("Restored document");
});
