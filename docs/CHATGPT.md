# Jotstead and ChatGPT

This release adds personal local ChatGPT sign-in, optional plan inference, selected-content saves, shared project briefs and a desktop MCP plugin. Web and installable PWA remain Jotstead's clients. Remote commercial authentication, native binaries, Claude/Gemini, automatic chat/project/memory imports and a public plugin-directory listing are outside this release.

## First connection

1. Run `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm preview` with Node 24+ and pnpm 11.19.0.
2. If this workspace already has a password, open it with that password first and use **Settings → ChatGPT & integrations → Connect ChatGPT for sign-in**. This migration proof is tied to the pending sign-in; an unauthenticated visitor cannot claim existing notes. Otherwise, open **http://127.0.0.1:3000** and click **Continue with ChatGPT**. Complete the OpenAI browser login yourself. The initial request asks only for identity scopes.
3. The callback verifies OpenAI's ID-token signature, issuer, issued client audience, expiry and nonce. Before the first owner binding, it snapshots `data/workspace.sqlite` to `data/pre-chatgpt-backup/`. Existing uploads remain in place. A different verified identity cannot replace the owner.
4. In **Settings → ChatGPT & integrations**, choose **Enable ChatGPT plan usage** and approve that additional permission if desired. Eligible plan access and provider availability are governed by OpenAI. No API key is created and no key payment is triggered as a fallback.

The documented open-source flow uses dynamic client registration, a stable host identifier, PKCE and an HTTP loopback callback. Remote websites require a different registered deployment flow; the personal integration deliberately refuses a remote callback. [OpenAI registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

## Sign-in troubleshooting

**`invalid_client` means OpenAI rejected the application's client configuration.** It does not establish a problem with your ChatGPT password. Repeatedly choosing the same account will not fix an unavailable registration. If OpenAI leaves you on its error screen, return to Jotstead; errors that reach our callback now show a safe **Return to Jotstead** link and preserve your notes. [OpenAI recovery guidance](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery)

The October 4 local inspection found no bound owner, no saved registration and no placeholder client in the primary runtime. Jotstead's initial request uses `dynamic_agent_client`, its stable host ID, `agent_name_hint=Jotstead`, PKCE and `http://127.0.0.1:3000/auth/callback`. This matches the documented local flow. Port 1455 is an example, not a requirement; another available port is supported. Changing ports, inventing an `oaiapp_` ID or using an API key cannot substitute for an accepted OAuth registration. The exact upstream reason for the account-selection rejection has not been verified.

Leave `JOTSTEAD_CHATGPT_CLIENT_ID` unset for initial local registration. If OpenAI supplies an actual issued **local** client for this runtime, you can set it in the ignored server-side `.env.local` and restart Jotstead. The callback must use HTTP, `127.0.0.1` and `/auth/callback`. The app rejects obvious placeholders and refuses a configured client that differs from an already bound owner's registration. A syntactically valid ID alone does not prove OpenAI issued or enabled it. Never replace an owner's registration or delete `auth.sqlite` to work around this error.

A hosted website requires its own OpenAI-issued OAuth client, registered callbacks and provisioned authentication method. OpenAI's website programme is currently a limited trial. This local implementation does not pretend to supply that approval or a hosted client. If the correctly formed first-time local request is still rejected, OpenAI must diagnose or enable the registration; provide its error code and request ID to OpenAI through your own support channel. [Hosted website requirements](https://developers.openai.com/siwc/website)

Expired codes (`invalid_grant`) now request a fresh sign-in while retaining the issued client. Explicitly enabling plan usage requests consent; ordinary sign-ins do not force it. Failed attempts never bind ownership or overwrite existing credentials. No API key is created, no client secret is needed for this local public-client flow, and access controls remain unchanged.

Validation: 11 new regression cases failed against the previous behavior and pass after the changes. The full check passes 92 tests, TypeScript, the production build and HTTP checks. In an isolated browser preview, an example client was rejected before leaving Jotstead, the help panel opened, and a forged callback showed generic recovery with a working return link. A valid `invalid_client` callback and token response were exercised by integration tests. A successful live OpenAI registration has **not** been confirmed.

A browser session lasts seven days and can be renewed by signing in again. AI tokens refresh independently with a cross-process lease, atomic credential/version snapshots and replacement-token checks. Disconnect and sign-out invalidate pending authorizations across this personal workspace, including callbacks already exchanging a code. AI expiry or quota does not invalidate your note session. **Sign out on this device** revokes that local session and requests clearing browser storage. **Disconnect AI** stops using provider tokens immediately, attempts remote revocation and reports when it cannot confirm remote revocation. It preserves the owner/client mapping for a later sign-in. Plugin permissions are separate controls. [OpenAI session and credential guidance](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)

## Writing and project context

Open **Ask AI**, choose a discovered model, check up to 12 pages and submit your request. No pages are selected by default. Only selected live page text and their shared briefs are sent. References are bounded to 60,000 characters in total; large selections prompt you to choose fewer pages. The assistant treats page content as reference data, never higher-priority instructions.

ChatGPT inference uses the public Responses API with `store:false`, streamed output and the model returned by the provider. A completion marker is required before **Review & save to Jotstead** becomes available. A quota error after partial text, cancellation or interruption leaves the partial answer unsaveable as a finished response. There is no silent switch to another paid provider. [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview restrictions](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

**Shared project brief** on a page stores goals, preferences, decisions, next actions and an optional real ChatGPT conversation/share URL. It stays editable, survives JSON export/import and participates in page history. Public page projections omit the brief. Jotstead AI includes it only when you select that page. The plugin reads it only when that page is allowed.

**Save from ChatGPT** accepts pasted selected content, a destination and an optional source chat URL. It appends to a normal page or creates a visible page/row in a database; it never hides a capture in a database's unused note body. Selected headings are preserved. Source attribution becomes a clickable document link. Content edits use the existing autosave/revision conflict system. The server capture API and plugin use current revisions and retry identifiers.

## Personal plugin

```bash
pnpm run plugin:install
```

The command builds a self-contained Node 24 stdio runtime and MCP Apps UI, prepares a machine-local marketplace in `.codex/local-marketplace`, writes this machine's runtime/data paths only to that ignored copy, and uses the supported `codex plugin marketplace add` / `codex plugin add` flow. It preserves other marketplaces. Reload the desktop host to load the installed plugin. Portable source is in `plugins/jotstead`; build outputs are reproducible and ignored. A standalone export can contain `plugin.json`, `mcp.json`, `skills`, `assets` and the compiled `server/dist` directory. Adjust its `JOTSTEAD_DATA_DIR` to your workspace before installation; its default is an isolated `workspace-data` directory, never an inferred private path.

In Jotstead Settings, enable the plugin, select each permitted page, and optionally allow writes. Access is disabled by default. No selected pages means no readable page content. Selecting a database does not select its rows, relations, child notes or rollup sources. Creates need a permitted parent; newly created pages need their own scope before subsequent reads. Trash operations touching unselected descendants fail instead of escaping the scope. Revoking permission takes effect on the next tool call.

Tools: `search_workspace`, `read_page`, `create_page`, `edit_page`, `trash_page`, `query_database`, `create_database_row`, `update_database_row`, `save_to_jotstead`, `read_project_brief`, `update_project_brief`, `create_tasks`, `preview_page`, `open_jotstead`.

The **Project companion** thread panel uses the MCP Apps bridge for page previews and selected saves. It renders untrusted content as text and sends writes through server-side permission/revision checks. Tools remain usable in hosts without the panel. Local stdio requires a supporting desktop/local host; installing this package does not make a local computer process available in classic ChatGPT web or mobile. Host support varies. [OpenAI UI integration](https://developers.openai.com/plugins/build/chatgpt-ui), [Extensions](https://developers.openai.com/plugins/build/extensions)

## Storage and privacy

`data/auth.sqlite` is separate from workspace state. Provider credentials are AES-256-GCM encrypted with `data/auth.key`; both files use owner-only permissions. The key stays on this computer, so encryption does not protect against another process already running as this OS user. Provider tokens never enter browser storage, workspace exports, plugin results or routine backups. HTTP-only cookies contain random local session/attempt identifiers, never provider tokens.

The first connection stores one owner and registration. This is intentionally a single-owner workspace: account switching that would expose existing notes is rejected. Ordinary backups copy notes and attachments only. Preserve protected auth files separately when recovering the same bound runtime, or reauthorize into an explicitly fresh data directory. Never commit auth files, keys, `.env`, real workspace data or diagnostics containing authorization URLs. `next` production tracing excludes these paths.

A personal API token remains an explicit independent administrative credential for the existing HTTP API. A configured compatible local/provider endpoint remains optional; an enabled ChatGPT connection's errors never fall back to that endpoint automatically.

## Validation boundaries

Automated checks cover signed JWT mismatches, PKCE/browser binding, callback replay, encrypted persistence, owner mismatch, session revocation, refresh leasing, stale credential replacement, context selection, brief/export validation, terminal SSE errors, frontend save gating, revision/idempotent captures, real source and bundled MCP roundtrips, scope enforcement and embedded UI syntax. Production HTTP checks verify guarded routes and capture conflicts. Browser checks use a disposable local workspace and a clearly labeled isolated MCP Apps host connected to the real plugin runtime.

No live OpenAI account login, plan inference, remote revocation or native ChatGPT panel loading was completed by the agent. Those require your own interactive consent and a host reload; the isolated panel screenshot is protocol verification, not evidence of a live ChatGPT conversation. Physical mobile installation and remote deployment remain unverified.
