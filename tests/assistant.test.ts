// @vitest-environment happy-dom
import { it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AIAssistant } from "../src/features/chatgpt/assistant";
import { createSeed } from "../src/lib/seed";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps partial answers unsaveable after a late error and sends only explicit page context", async () => {
  const workspace = createSeed();
  let sent: { contextPageIds: string[] } | null = null;
  vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => {
    if (!options?.method)
      return Response.json({
        models: [{ id: "fixture", name: "Protocol test model" }],
        provider: "chatgpt",
      });
    sent = JSON.parse(String(options.body));
    return new Response(
      JSON.stringify({ type: "delta", text: "A partial answer" }) +
        "\n" +
        JSON.stringify({ type: "error", error: "Allowance exhausted" }) +
        "\n",
      { headers: { "Content-Type": "application/x-ndjson" } },
    );
  });
  const ui = render(
    React.createElement(AIAssistant, {
      pages: workspace.pages,
      pageId: workspace.pages[0].id,
      onSave: vi.fn(),
      onClose: vi.fn(),
      onSettings: vi.fn(),
    }),
  );
  await waitFor(() =>
    expect(
      ui.getByRole("option", { name: "Protocol test model" }),
    ).toBeTruthy(),
  );
  fireEvent.change(ui.getByRole("textbox", { name: "Ask AI" }), {
    target: { value: "Help me plan" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Ask AI" }));
  await waitFor(() =>
    expect(ui.getByRole("alert").textContent).toContain("Allowance exhausted"),
  );
  expect(
    (sent as unknown as { contextPageIds: string[] }).contextPageIds,
  ).toEqual([]);
  expect(ui.getByText("A partial answer")).toBeTruthy();
  expect(
    ui.queryByRole("button", { name: "Review & save to Jotstead" }),
  ).toBeNull();
});
it("makes only explicitly completed responses reviewable", async () => {
  vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) =>
    !options?.method
      ? Response.json({
          models: [{ id: "fixture", name: "Protocol test model" }],
          provider: "chatgpt",
        })
      : new Response(
          '{"type":"delta","text":"Finished answer"}\n{"type":"completed"}\n',
          { headers: { "Content-Type": "application/x-ndjson" } },
        ),
  );
  const ui = render(
    React.createElement(AIAssistant, {
      pages: createSeed().pages,
      onSave: vi.fn(),
      onClose: vi.fn(),
      onSettings: vi.fn(),
    }),
  );
  await waitFor(() =>
    expect(
      ui.getByRole("option", { name: "Protocol test model" }),
    ).toBeTruthy(),
  );
  fireEvent.change(ui.getByRole("textbox", { name: "Ask AI" }), {
    target: { value: "Write a draft" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Ask AI" }));
  await waitFor(() =>
    expect(
      ui.getByRole("button", { name: "Review & save to Jotstead" }),
    ).toBeTruthy(),
  );
});
