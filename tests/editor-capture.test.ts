// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { createSeed } from "../src/lib/seed";
import { validateWorkspace, textOf } from "../src/lib/model";
import { saveSelection } from "../src/lib/shared-context";
it("autosaves an attributed capture after the real editor normalizes its link attributes", () => {
  const workspace = createSeed();
  const saved = saveSelection(workspace, {
    mode: "create",
    title: "Saved decision",
    markdown: "# Decision\nShare selected pages only.",
    sourceChatUrl: "https://chatgpt.com/c/test-conversation",
  });
  const page = workspace.pages.find((p) => p.id === saved.id)!;
  const editor = new Editor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: page.content,
  });
  try {
    editor.commands.insertContentAt(1, "Reviewed: ");
    page.content = editor.getJSON();
    const persisted = validateWorkspace(workspace).pages.find(
      (p) => p.id === saved.id,
    )!;
    expect(textOf(persisted.content)).toContain("Decision");
    expect(JSON.stringify(persisted.content)).toContain(
      "https://chatgpt.com/c/test-conversation",
    );
  } finally {
    editor.destroy();
  }
});
