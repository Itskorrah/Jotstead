"use client";
import { ChatGPTConnection } from "@/features/chatgpt/connection";
import { useState, useEffect } from "react";
import {
  DownloadSimpleIcon,
  UploadSimpleIcon,
  DesktopIcon,
  MoonIcon,
  SunIcon,
  SignOutIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Modal, Field, download } from "@/components/ui";
import { type Workspace, type Rule, type Value, uid } from "@/lib/model";
import {
  workspaceExport,
  parseWorkspaceExport,
  importMarkdown,
  importCsv,
} from "@/lib/transfer";
export function Settings({
  workspace,
  update,
  onClose,
  onImport,
  onSignOut,
  theme,
  setTheme,
  onInstall,
}: {
  workspace: Workspace;
  update: (fn: (w: Workspace) => void) => void;
  onClose: () => void;
  onImport: () => void;
  onSignOut: () => void;
  theme: string;
  setTheme: (t: string) => void;
  onInstall: () => void;
}) {
  const [tab, setTab] = useState("workspace");
  const [ai, setAi] = useState<{ available: boolean; model: string } | null>(
    null,
  );
  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => {});
  }, []);
  return (
    <Modal wide title="Settings" onClose={onClose}>
      <div className="settings-layout">
        <nav>
          {[
            ["workspace", "Workspace"],
            ["appearance", "Appearance"],
            ["apps", "Apps & offline"],
            ["automations", "Automations"],
            ["ai", "ChatGPT & integrations"],
          ].map(([id, t]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "workspace" && (
            <>
              <h3>Your workspace</h3>
              <Field label="Workspace name">
                <input
                  value={workspace.name}
                  maxLength={80}
                  onChange={(e) => {
                    if (e.target.value)
                      update((w) => {
                        w.name = e.target.value;
                      });
                  }}
                />
              </Field>
              <div className="settings-stat">
                <strong>
                  {workspace.pages.filter((p) => !p.deletedAt).length}
                </strong>{" "}
                pages. A place for your notes, projects, and ideas.
              </div>
              <h3>Import & export</h3>
              <p>
                Keep a portable copy of your workspace. JSON preserves pages,
                properties, and views; attachment files stay on your server.
              </p>
              <button
                className="subtle"
                onClick={() =>
                  download(
                    "jotstead-workspace.json",
                    workspaceExport(workspace),
                  )
                }
              >
                <DownloadSimpleIcon size={18} />
                Export entire workspace
              </button>
              <button className="subtle" onClick={onImport}>
                <UploadSimpleIcon size={18} />
                Import JSON, Markdown, or CSV
              </button>
              <h3>Privacy</h3>
              <p>
                Pages are private until you publish them. Your workspace is
                stored on the server you run.
              </p>
              <button className="subtle" onClick={onSignOut}>
                <SignOutIcon size={18} />
                Sign out on this device
              </button>
            </>
          )}
          {tab === "appearance" && (
            <>
              <h3>Appearance</h3>
              <p>Choose how Jotstead looks on this device.</p>
              <div className="theme-options">
                {[
                  ["light", "Light", SunIcon],
                  ["dark", "Dark", MoonIcon],
                  ["system", "Use device setting", DesktopIcon],
                ].map(([id, t, Icon]) => {
                  const I = Icon as typeof SunIcon;
                  return (
                    <button
                      key={id as string}
                      className={theme === id ? "active" : ""}
                      onClick={() => setTheme(id as string)}
                    >
                      <I size={24} />
                      {t as string}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {tab === "apps" && (
            <>
              <h3>Jotstead, wherever you work</h3>
              <p>
                The same workspace works on your desktop, phone, and tablet.
                Install it from a supported browser to open it in its own
                window.
              </p>
              <button className="primary" onClick={onInstall}>
                <DownloadSimpleIcon size={17} />
                Install Jotstead
              </button>
              <p className="muted">
                On iPhone or iPad: open in Safari, tap Share, then Add to Home
                Screen. On desktop or Android: use the browser’s Install option.
              </p>
              <h3>Working offline</h3>
              <p>
                After opening your workspace online, this device keeps a copy.
                Edits are kept locally when the server is unavailable and sent
                when it returns. If another device has edited the workspace,
                you’ll choose which version to keep.
              </p>
              <p className="muted">
                Attachments and AI need your server. Keep regular server backups
                as well as workspace exports.
              </p>
            </>
          )}
          {tab === "automations" && (
            <Rules workspace={workspace} update={update} />
          )}
          {tab === "ai" && <ChatGPTConnection pages={workspace.pages}/>}
        </div>
      </div>
    </Modal>
  );
}
function Rules({
  workspace,
  update,
}: {
  workspace: Workspace;
  update: (fn: (w: Workspace) => void) => void;
}) {
  const databases = workspace.pages.filter(
    (p) => p.kind === "database" && !p.deletedAt,
  );
  const [draft, setDraft] = useState<Rule | null>(null);
  const db = databases.find((p) => p.id === draft?.databaseId);
  return (
    <>
      <h3>Database automations</h3>
      <p>
        When an edited property matches a value, set another property on that
        row. Rules run once per edit, so they never loop.
      </p>
      {workspace.rules.map((r) => (
        <div className="rule-row" key={r.id}>
          <input
            type="checkbox"
            aria-label={`Enable ${r.name}`}
            checked={r.enabled}
            onChange={(e) =>
              update((w) => {
                w.rules.find((x) => x.id === r.id)!.enabled = e.target.checked;
              })
            }
          />
          <button onClick={() => setDraft(r)}>{r.name}</button>
          <IconButtonSmall
            onClick={() =>
              update((w) => {
                w.rules = w.rules.filter((x) => x.id !== r.id);
              })
            }
          />
        </div>
      ))}
      <button
        className="subtle"
        disabled={!databases.length}
        onClick={() =>
          setDraft({
            id: uid(),
            databaseId: databases[0].id,
            name: "New automation",
            whenProperty: databases[0].properties[0]?.id || "",
            whenValue: "",
            setProperty: "",
            setValue: "",
            enabled: true,
          })
        }
      >
        <PlusIcon size={16} />
        New automation
      </button>
      {draft && (
        <form
          className="automation-form"
          onSubmit={(e) => {
            e.preventDefault();
            update((w) => {
              const i = w.rules.findIndex((x) => x.id === draft.id);
              if (i < 0) w.rules.push(draft);
              else w.rules[i] = draft;
            });
            setDraft(null);
          }}
        >
          <Field label="Name">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Database">
            <select
              value={draft.databaseId}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  databaseId: e.target.value,
                  whenProperty: "",
                  setProperty: "",
                })
              }
            >
              {databases.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="When this property changes">
            <select
              required
              value={draft.whenProperty}
              onChange={(e) =>
                setDraft({ ...draft, whenProperty: e.target.value })
              }
            >
              <option value="">Choose property</option>
              {db?.properties
                .filter(
                  (p) =>
                    !["formula", "rollup", "relation", "multiSelect"].includes(
                      p.type,
                    ),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Matches this value">
            <input
              value={draft.whenValue}
              onChange={(e) =>
                setDraft({ ...draft, whenValue: e.target.value })
              }
            />
          </Field>
          <Field label="Set this property">
            <select
              required
              value={draft.setProperty}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  setProperty: e.target.value,
                  setValue:
                    db?.properties.find((p) => p.id === e.target.value)
                      ?.type === "checkbox"
                      ? false
                      : db?.properties.find((p) => p.id === e.target.value)
                            ?.type === "number"
                        ? null
                        : "",
                })
              }
            >
              <option value="">Choose property</option>
              {db?.properties
                .filter(
                  (p) =>
                    !["formula", "rollup", "relation", "multiSelect"].includes(
                      p.type,
                    ),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="To this value">
            <input
              value={String(draft.setValue ?? "")}
              onChange={(e) => {
                const p = db?.properties.find(
                  (p) => p.id === draft.setProperty,
                );
                const v: Value =
                  p?.type === "number"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : p?.type === "checkbox"
                      ? e.target.value === "true"
                      : e.target.value;
                setDraft({ ...draft, setValue: v });
              }}
            />
          </Field>
          <div className="modal-actions">
            <button
              type="button"
              className="subtle"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
            <button className="primary">Save automation</button>
          </div>
        </form>
      )}
    </>
  );
}
function IconButtonSmall({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="icon-button"
      aria-label="Delete automation"
      onClick={onClick}
    >
      <TrashIcon size={16} />
    </button>
  );
}
export function ImportDialog({
  workspace,
  replace,
  append,
  onClose,
}: {
  workspace: Workspace;
  replace: (w: Workspace) => void;
  append: (p: Workspace["pages"]) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(""),
    [filename, setFilename] = useState(""),
    [format, setFormat] = useState("json"),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<Workspace | Workspace["pages"] | null>(
    null,
  );
  const analyze = () => {
    try {
      const parsed =
        format === "json"
          ? parseWorkspaceExport(content)
          : format === "csv"
            ? importCsv(
                content,
                filename.replace(/\.csv$/i, "") || "Imported database",
              )
            : [
                importMarkdown(
                  content,
                  filename.replace(/\.md$/i, "") || "Imported page",
                ),
              ];
      setPreview(parsed);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? "issues" in e
            ? "This is not a valid Jotstead workspace. Use a complete workspace JSON export or select the correct import format."
            : e.message
          : "Could not import",
      );
      setPreview(null);
    }
  };
  return (
    <Modal title="Import your content" onClose={onClose}>
      <p>
        Full workspace JSON replaces this workspace. Markdown and CSV add new
        pages.
      </p>
      <Field label="Import format">
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setPreview(null);
          }}
        >
          <option value="json">Jotstead workspace JSON</option>
          <option value="md">Markdown (.md)</option>
          <option value="csv">CSV database (.csv)</option>
        </select>
      </Field>
      <input
        type="file"
        aria-label="Choose import file"
        accept=".json,.md,.markdown,.csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 6 * 1024 * 1024) {
            setError(
              "Import files can be up to 6 MB, with at most 5 MiB of workspace data.",
            );
            return;
          }
          setFilename(file.name);
          setFormat(
            file.name.toLowerCase().endsWith(".csv")
              ? "csv"
              : file.name.toLowerCase().endsWith(".json")
                ? "json"
                : "md",
          );
          setContent(await file.text());
          setPreview(null);
        }}
      />
      <Field label="Or paste content">
        <textarea
          rows={6}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setPreview(null);
          }}
        />
      </Field>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {preview && (
        <div className="import-preview">
          <strong>
            {Array.isArray(preview) ? preview.length : preview.pages.length}{" "}
            pages ready
          </strong>
          <p>
            {format === "json"
              ? "Export your current workspace first. Replacing it will overwrite its pages and views."
              : "Markdown imports basic headings, lists, tasks, quotes, and code. Rich formatting, inline database links, and local attachment paths may need correction. CSV imports property cells as text."}
          </p>
          <div className="modal-actions">
            {format === "json" && (
              <button
                className="subtle"
                onClick={() =>
                  download(
                    "jotstead-before-import.json",
                    workspaceExport(workspace),
                  )
                }
              >
                Export current workspace
              </button>
            )}
            <button
              className="primary"
              onClick={() => {
                if (Array.isArray(preview)) append(preview);
                else replace(preview);
                onClose();
              }}
            >
              {format === "json" ? "Replace workspace" : "Import pages"}
            </button>
          </div>
        </div>
      )}
      <button className="subtle" disabled={!content.trim()} onClick={analyze}>
        Check import
      </button>
    </Modal>
  );
}
