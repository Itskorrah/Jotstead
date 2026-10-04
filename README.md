# Jotstead

**A home for your ideas.** A personal Notion-style workspace with original branding, built with Next.js, React, Tiptap, and SQLite. Web, desktop, and mobile use the same installable PWA. There are no separate native binaries or app store releases.

![Jotstead icon](public/icons/icon-192.png)

## Run locally

Requires **Node 24+** and **pnpm 11.19.0**.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. The development server binds only to loopback. The first run creates a sample workspace; after that all changes persist in `data/workspace.sqlite`. Uploads are in `data/uploads`. Neither data nor secrets are committed to Git.

For the production PWA on this computer, run `pnpm build` then **`pnpm preview`**. Open **http://127.0.0.1:3000** to enter your workspace directly. ChatGPT connection is optional in **Settings → ChatGPT & integrations**. First verified connection backs up the workspace before binding it to your account. See [ChatGPT setup and plugin guide](docs/CHATGPT.md).

`pnpm dev`, `pnpm start` and `pnpm preview` default to direct workspace access on this computer, binding only to loopback. This remains available after connecting ChatGPT. Use `pnpm preview --protected` or `JOTSTEAD_LOCAL_ONLY=0` to require authentication locally. Password-protected launches, remote bind addresses and remote public URLs always require authentication. Direct container/server launches remain protected. Local access trusts users and processes on this computer; never expose it through a tunnel.

## What works

- Nested pages, favorites, search, keyboard palette, trash/restore, templates, original icons, covers, light/dark/system themes, page fonts and widths.
- Rich documents: slash commands, headings, lists, checkboxes, toggles, callouts, quotes, code, images/files, simple tables, columns, linked pages/backlinks, inline formatting, block movement/duplication/deletion, drag reorder, undo/redo.
- Database row pages with typed properties; saved table, board, gallery, list, calendar, milestone timeline, and count chart views. Shared filters, sorts, status grouping, relations, scoped formulas and rollups.
- Server autosave, optimistic revision checks, retry IDs, IndexedDB drafts, explicit conflict recovery, page history, comments, JSON/Markdown/CSV export and basic imports.
- Explicit public page publishing and database submission forms. Other pages, child pages, row values, and comments stay private. Publishing a page makes attachments used by that page accessible to readers until it is unpublished.
- Single-owner ChatGPT sessions, optional ChatGPT plan inference, selected-page context, shared project briefs, reviewed captures with source attribution, protected local MCP plugin, same-origin writes, filesystem uploads, optional compatible AI provider and database rules.

See [feature coverage](docs/FEATURES.md) for exact boundaries. This is an independently implemented personal workspace, not full Notion parity. The visual baseline comes from official public Notion editor/database help screenshots; no private logged-in Notion workspace was available.

## Install as an app

With HTTPS or localhost, supported desktop/Android browsers can install Jotstead using their **Install app** command. On iPhone/iPad, open it in Safari → Share → Add to Home Screen. Settings → Apps & offline contains the instructions.

The production service worker caches the app shell and local static assets. IndexedDB stores a workspace copy and unsaved drafts on each device. After first use online, previously opened editor code and pages can reopen when the server is unavailable. Previously unvisited lazy components, attachments and AI may require a connection. A reconnect checks the server revision before saving; conflicts require a choice rather than overwriting data silently. Use a device/browser profile you trust; sign-out requests clearing this origin’s cache/storage and removes the active copy; browsers that do not honor the clearing header may retain recovery archives until you clear site data.

## Production / self-hosting

```bash
cp .env.example .env
# Set JOTSTEAD_PASSWORD to your own strong password in .env
# Set JOTSTEAD_PUBLIC_URL to the exact browser origin, e.g. https://jotstead.example.com
# Use JOTSTEAD_COOKIE_SECURE=1 when behind HTTPS
# Do not set JOTSTEAD_LOCAL_ONLY on a remote deployment

docker compose up --build -d
```

Compose binds `127.0.0.1:3000` and uses a named persistent volume. Put an HTTPS reverse proxy in front of it for remote access; set a 21 MB upload/body limit and proxy rate limits. Do not expose the Next.js port directly to the internet. A custom domain can point to that proxy; purchasing/provisioning the domain is outside this repository.

Without Docker:

```bash
pnpm build
# Set JOTSTEAD_PASSWORD and any needed origin/HTTPS environment values first
pnpm start
```

This SQLite architecture requires persistent local disk and **one server instance**. It is not suited to ephemeral Vercel function storage or multiple replicas. Serverless deployment would require a persistent storage adapter. Production containers and physical iOS/Android installation have not been run on this machine; see the validation report.

## Back up and restore

```bash
pnpm backup
# Or choose a new destination directory:
pnpm backup /path/to/new-backup-directory
```

The command checkpoints SQLite and creates an independent SQLite snapshot plus a copy of uploads. OAuth credentials and the vault key are intentionally excluded. Preserve the original protected `auth.sqlite` and `auth.key` locally if restoring notes into the same bound workspace; a fresh data directory requires new account binding. **Pause writes during backup** to keep attachment uploads consistent with the snapshot. Keep backups on a different disk/location. Exported workspace JSON excludes attachment bytes and historical revisions; it is not a complete server backup.

Restore: stop Jotstead, preserve the current data directory, copy the backup's `workspace.sqlite` and `uploads/` into a fresh data directory, point `JOTSTEAD_DATA_DIR` there, and restart. Do not copy old `-wal`/`-shm` files with the restored database. The included restore test opens a new store from a backup and verifies persisted pages and attachment bytes.

## Optional AI

Set these **server-only** variables and restart:

```dotenv
JOTSTEAD_AI_URL=http://127.0.0.1:11434/v1
JOTSTEAD_AI_MODEL=llama3.2
# JOTSTEAD_AI_KEY=your-provider-key-if-needed
```

`JOTSTEAD_AI_URL` is an OpenAI-compatible `/v1` base URL. Ollama can provide it locally; another compatible provider can use its own URL/key/model. In Docker, localhost is the container: use an appropriate host or service address. AI requests send only the page context explicitly checked in the assistant. There is no semantic/vector search or file-content RAG. Responses can be reviewed and saved; AI never edits autonomously. ChatGPT plan inference is enabled separately through Settings, with discovered models and completion-aware streaming. No real provider login or API key was provisioned during validation.

## API and MCP

For API clients, set `JOTSTEAD_API_TOKEN` on the server and use `Authorization: Bearer <token>`. Keep the token private. `GET /api/workspace` returns `{revision,data}`. `PUT /api/workspace` accepts `{baseRevision,mutationId,data}` and returns HTTP 409 if stale. Validate payloads against `src/lib/model.ts`; use a fresh unique mutation ID for each change. `GET /api/history?page=<id>` returns recent page versions. The owner token grants full workspace access.

The local MCP server is **owner-level disk access for a trusted agent**, using the same validated store and revision checks. Example client configuration (replace the absolute path and executable with your installation):

```json
{
  "mcpServers": {
    "jotstead": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/Jotstead", "exec", "tsx", "scripts/mcp.ts"],
      "env": {"JOTSTEAD_DATA_DIR": "/absolute/path/to/Jotstead/data"}
    }
  }
}
```

Tools include page search/read/edit, database queries, `save_to_jotstead`, `read_project_brief`, `update_project_brief`, `create_tasks`, `preview_page` and the Project companion conversation panel. Enable the plugin in Settings → ChatGPT & integrations, select individual pages and separately allow writes. Each mutation requires the latest revision. Child pages and database rows need individual scopes; new child pages become readable only after selecting them. MCP uses trusted local process access, separate from the browser session. See [plugin installation](docs/CHATGPT.md#personal-plugin).

## Validation and development

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm verify:http
pnpm audit --audit-level=high
```

The [GitHub Actions template](docs/ci/github-actions.yml) repeats these checks on push/PR when enabled. The connected GitHub credential lacks `workflow` permission, so the template is delivered outside the active workflows directory. To enable it with an authorized credential, copy it to `.github/workflows/ci.yml`; no remote CI run is claimed. [Validation evidence](docs/VALIDATION.md) and [visual review](docs/design-qa.md) describe actual browser workflows, screenshots, fixes and remaining gaps. [Skills used](SKILLS.md) records the requested skills.sh discovery and selected guidance. Keep functions/types clear, share the canonical database query layer, and never add fake buttons for unavailable services.

Resource limits protect a personal server: 5 MiB canonical workspace state (6 MiB request/import envelope), 20 MiB uploads, 2,000 pages, 100 properties per database, 30 views, and document depth 32. There are no paid unlocks. Stored history is retained on disk; the UI shows the latest 100 records for a page. Monitor disk space and keep independent backups.

Original project code is MIT licensed. Notion is a separate product and this project is not affiliated with it. Notion screenshots in `docs/reference` are used solely for implementation comparison and are not application assets.
