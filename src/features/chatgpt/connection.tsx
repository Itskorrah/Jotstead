"use client";
import { useEffect, useState } from "react";
import type { Page } from "@/lib/model";
type Status = {
  authenticated: boolean;
  ownerBound: boolean;
  legacyPassword: boolean;
  connected: boolean;
  sharing: boolean;
  account?: { name?: string; email?: string } | null;
  plugin?: { enabled: boolean; writes: boolean; pageIds: string[] };
};
export async function connectChatGPT(sharing = false) {
  if (location.hostname === "localhost") {
    location.assign(location.href.replace("localhost", "127.0.0.1"));
    return;
  }
  const r = await fetch("/api/chatgpt/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sharing }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error);
  location.assign(body.url);
}
function SignInHelp() {
  return (
    <details className="login-password">
      <summary>ChatGPT says “This app is unavailable”?</summary>
      <p className="muted">
        That message concerns Jotstead’s app registration. Return here if OpenAI
        shows it; your notes are preserved. Local registration availability is
        controlled by OpenAI.
      </p>
      <a
        href="https://github.com/Itskorrah/Jotstead/blob/main/docs/CHATGPT.md#sign-in-troubleshooting"
        target="_blank"
        rel="noreferrer"
      >
        Sign-in troubleshooting ↗
      </a>
    </details>
  );
}
export function ChatGPTLogin({
  onLogin,
  draftExport,
  notice,
}: {
  onLogin: () => Promise<void>;
  draftExport?: () => void;
  notice?: string;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    fetch("/api/chatgpt")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("Could not check sign-in. Refresh to retry."));
  }, []);
  return (
    <main className="login" aria-labelledby="login-heading">
      <div className="login-content">
        <header className="login-heading">
          <div className="login-brand">
            <img src="/icons/icon-192.png" alt="" width={40} height={40} />
            <span>Jotstead</span>
          </div>
          <h1 id="login-heading">A home for your ideas.</h1>
          <p className="login-subtitle">
            Sign in with ChatGPT to open your personal workspace.
          </p>
        </header>
        {notice && (
          <p className="login-notice" role="status">
            {notice}
          </p>
        )}
        <button
          className="chatgpt-button"
          disabled={busy || !!status?.legacyPassword}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              await connectChatGPT();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening ChatGPT…" : "Continue with ChatGPT"}
        </button>
        <div className="login-notes">
          <p>
            Your notes stay in Jotstead. AI is optional and can be enabled in
            Settings.
          </p>
          {!status?.ownerBound && (
            <p>
              Your first sign-in links this workspace to your verified account
              and backs up your notes.
            </p>
          )}
        </div>
        {status?.legacyPassword && (
          <p className="muted login-detail">
            Open this workspace with its existing password first, then connect
            ChatGPT in Settings.
          </p>
        )}
        {status?.legacyPassword && (
          <details className="login-password" open>
            <summary>Existing workspace password</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password }),
                  });
                  const b = await r.json();
                  if (!r.ok) throw new Error(b.error);
                  await onLogin();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                aria-label="Workspace password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                Continue
              </button>
            </form>
          </details>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <SignInHelp />
        {draftExport && (
          <div className="login-recovery">
            <button className="subtle" onClick={draftExport}>
              Export your unsaved draft
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
export function ChatGPTConnection({ pages }: { pages: Page[] }) {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/chatgpt")
      .then((r) => r.json())
      .then(setStatus);
  useEffect(() => {
    load().catch(() => setError("Could not load your connection."));
  }, []);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const permission = async (patch: Partial<NonNullable<Status["plugin"]>>) => {
    const next = {
      enabled: false,
      writes: false,
      pageIds: [] as string[],
      ...status?.plugin,
      ...patch,
    };
    const r = await fetch("/api/chatgpt", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!r.ok) throw new Error("Could not save plugin permissions");
    await load();
  };
  return (
    <div className="chatgpt-settings">
      <h3>ChatGPT connection</h3>
      <div
        className={`connection-status ${status?.connected ? "connected" : ""}`}
      >
        {status?.connected
          ? "Connected to ChatGPT"
          : "ChatGPT is not connected"}
      </div>
      {status?.account && (
        <p>
          {status.account.name || "Workspace owner"}
          {status.account.email ? ` · ${status.account.email}` : ""}
        </p>
      )}
      <p>
        Use your eligible ChatGPT plan for writing, summaries and questions
        about pages you select. Your AI allowance is shared with other connected
        apps.
      </p>
      {status && !status.ownerBound && (
        <button
          className="chatgpt-button"
          disabled={busy}
          onClick={() => act(() => connectChatGPT(false))}
        >
          Connect ChatGPT for sign-in
        </button>
      )}
      <button
        className="chatgpt-button"
        disabled={busy}
        onClick={() => act(() => connectChatGPT(true))}
      >
        {status?.sharing ? "Reconnect ChatGPT" : "Enable ChatGPT plan usage"}
      </button>
      <p className="muted">
        {status?.sharing
          ? "AI usage permission granted. Notes remain available if AI runs out of allowance."
          : "AI usage has not been enabled. Connecting asks ChatGPT for your permission."}
      </p>
      <a
        href="https://chatgpt.com/#settings/Usage"
        target="_blank"
        rel="noreferrer"
      >
        Manage ChatGPT usage and connections ↗
      </a>
      <SignInHelp />
      {status?.connected && (
        <button
          className="subtle"
          disabled={busy}
          onClick={() =>
            act(async () => {
              const r = await fetch("/api/chatgpt", {
                method: "DELETE",
                headers: { Origin: location.origin },
              });
              const body = await r.json();
              if (!r.ok) throw new Error(body.error);
              await load();
              if (!body.remoteRevoked)
                setError(
                  "Disconnected locally. Remote revocation could not be confirmed; disconnect Jotstead in ChatGPT Settings too.",
                );
            })
          }
        >
          Disconnect AI
        </button>
      )}
      <h3>Personal ChatGPT plugin</h3>
      <p>
        Let a trusted desktop ChatGPT or Codex host use selected pages, shared
        project briefs and “Save to Jotstead”. Access starts disabled.
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={status?.plugin?.enabled || false}
          disabled={busy}
          onChange={(e) => act(() => permission({ enabled: e.target.checked }))}
        />
        Enable the personal plugin
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={status?.plugin?.writes || false}
          disabled={busy || !status?.plugin?.enabled}
          onChange={(e) => act(() => permission({ writes: e.target.checked }))}
        />
        Allow selected saves and edits
      </label>
      <div className="context-picker" aria-label="Plugin page access">
        {pages
          .filter((p) => !p.deletedAt)
          .map((p) => (
            <label key={p.id} className="check-row">
              <input
                type="checkbox"
                disabled={busy || !status?.plugin?.enabled}
                checked={status?.plugin?.pageIds.includes(p.id) || false}
                onChange={(e) =>
                  act(() =>
                    permission({
                      pageIds: e.target.checked
                        ? [...(status?.plugin?.pageIds || []), p.id]
                        : (status?.plugin?.pageIds || []).filter(
                            (id) => id !== p.id,
                          ),
                    }),
                  )
                }
              />
              {p.title || "Untitled"}
            </label>
          ))}
      </div>
      <p className="muted">
        Select each page you want to share. Database rows and child pages need
        their own permission. The local plugin requires a supporting desktop
        host; it does not automatically import ChatGPT chats or projects.
      </p>
      <a
        href="https://github.com/Itskorrah/Jotstead/blob/main/docs/CHATGPT.md"
        target="_blank"
        rel="noreferrer"
      >
        Plugin setup and privacy details ↗
      </a>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
