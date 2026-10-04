"use client";
import { useEffect, useRef, useState } from "react";
import { Modal, Field } from "@/components/ui";
import type { Page } from "@/lib/model";
import type { CaptureInput } from "@/lib/shared-context";
import { SaveSelection } from "./shared-workflow";
export function AIAssistant({
  pages,
  pageId,
  onSave,
  onClose,
  onSettings,
}: {
  pages: Page[];
  pageId?: string;
  onSave: (capture: CaptureInput) => void;
  onClose: () => void;
  onSettings: () => void;
}) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [model, setModel] = useState(""),
    [provider, setProvider] = useState(""),
    [mode, setMode] = useState("ask"),
    [ids, setIds] = useState<string[]>([]),
    [prompt, setPrompt] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [complete, setComplete] = useState(false),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const loadModels = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/ai");
      const b = await r.json();
      if (!r.ok || b.error) throw new Error(b.error || "Could not load models");
      setModels(b.models || []);
      setModel(b.models?.[0]?.id || "");
      setProvider(b.provider || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadModels();
    return () => controller.current?.abort();
  }, []);
  if (saving)
    return (
      <SaveSelection
        pages={pages}
        pageId={pageId}
        initialText={text}
        onSave={onSave}
        onClose={() => setSaving(false)}
      />
    );
  return (
    <Modal title="Ask Jotstead AI" onClose={onClose}>
      <p className="muted">
        {provider === "chatgpt"
          ? "Uses your ChatGPT plan allowance."
          : provider === "compatible"
            ? "Uses your configured AI provider."
            : "Connect ChatGPT to enable AI."}{" "}
        Only the pages checked below are sent. Shared briefs on selected pages
        are included.
      </p>
      {!models.length ? (
        <>
          <div className="connection-status">
            {loading ? "Loading available models…" : "AI is not connected"}
          </div>
          <p>
            Enable ChatGPT plan usage to ask questions and write with AI. Your
            workspace remains available without it.
          </p>
          <button className="subtle" onClick={onSettings}>
            Open connection settings
          </button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const abort = new AbortController();
            controller.current = abort;
            setBusy(true);
            setComplete(false);
            setText("");
            setError("");
            try {
              const r = await fetch("/api/ai", {
                method: "POST",
                signal: abort.signal,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt,
                  model,
                  mode,
                  contextPageIds: ids,
                }),
              });
              if (!r.ok) {
                const b = await r.json();
                throw new Error(
                  b.error || "AI could not complete the response",
                );
              }
              if (!r.headers.get("content-type")?.includes("ndjson")) {
                const b = await r.json();
                setText(b.text);
                setComplete(b.completed === true);
              } else {
                const reader = r.body!.getReader(),
                  decoder = new TextDecoder();
                let buffer = "",
                  finished = false;
                try {
                  while (true) {
                    const part = await reader.read();
                    if (part.done) break;
                    buffer += decoder.decode(part.value, { stream: true });
                    let i: number;
                    while ((i = buffer.indexOf("\n")) >= 0) {
                      const line = buffer.slice(0, i);
                      buffer = buffer.slice(i + 1);
                      if (!line) continue;
                      const event = JSON.parse(line);
                      if (event.type === "delta")
                        setText((t) => t + event.text);
                      if (event.type === "error") throw new Error(event.error);
                      if (event.type === "completed") finished = true;
                    }
                  }
                  if (!finished)
                    throw new Error(
                      "Response was interrupted. Please try again.",
                    );
                  setComplete(true);
                } finally {
                  await reader.cancel().catch(() => {});
                  reader.releaseLock();
                }
              }
            } catch (e) {
              setComplete(false);
              setError(
                abort.signal.aborted
                  ? "Response stopped. Partial text has not been saved."
                  : (e as Error).message,
              );
            } finally {
              setBusy(false);
              controller.current = null;
            }
          }}
        >
          <div className="ai-controls">
            <Field label="Model">
              <select
                value={model}
                disabled={busy}
                onChange={(e) => setModel(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Action">
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => setMode(e.target.value)}
              >
                {["ask", "rewrite", "summarize", "translate", "tasks"].map(
                  (m) => (
                    <option key={m} value={m}>
                      {
                        {
                          ask: "Ask a question",
                          rewrite: "Rewrite",
                          summarize: "Summarize",
                          translate: "Translate",
                          tasks: "Extract next actions",
                        }[m]
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <details>
            <summary>Context · {ids.length} pages selected</summary>
            <div className="context-picker">
              {pages
                .filter((p) => !p.deletedAt)
                .map((p) => (
                  <label className="check-row" key={p.id}>
                    <input
                      type="checkbox"
                      disabled={
                        busy || (!ids.includes(p.id) && ids.length >= 12)
                      }
                      checked={ids.includes(p.id)}
                      onChange={(e) =>
                        setIds(
                          e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((id) => id !== p.id),
                        )
                      }
                    />
                    {p.title || "Untitled"}
                    {p.sharedBrief ? " · project brief" : ""}
                  </label>
                ))}
            </div>
          </details>
          <p className="muted">
            {ids.length
              ? `Sharing: ${ids.map((id) => pages.find((p) => p.id === id)?.title).join(", ")}`
              : "No page content will be sent. Select pages to ask about your workspace."}
          </p>
          <textarea
            autoFocus
            required
            maxLength={4000}
            rows={3}
            aria-label="Ask AI"
            value={prompt}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like help with?"
          />
          <div className="modal-actions">
            <button
              className="subtle"
              type="button"
              disabled={busy}
              onClick={() => void loadModels()}
            >
              Refresh models
            </button>
            {busy ? (
              <button
                className="subtle"
                type="button"
                onClick={() => controller.current?.abort()}
              >
                Stop response
              </button>
            ) : (
              <button className="primary" disabled={!prompt.trim()}>
                Ask AI
              </button>
            )}
          </div>
        </form>
      )}
      {text && (
        <div className="ai-response" aria-live="polite">
          {text}
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {complete && text && (
        <button className="primary" onClick={() => setSaving(true)}>
          Review & save to Jotstead
        </button>
      )}
    </Modal>
  );
}
