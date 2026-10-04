# Feature coverage — Jotstead 1.0

This release is a single-owner personal workspace. It runs as a website and can be installed as a desktop/mobile PWA. There are no separate Electron, Swift, Android or app-store binaries.

| Area | Implemented | Boundary |
| --- | --- | --- |
| Pages | Nested tree, drag/move, favorites, search, navigation, duplicate subtree, templates, trash and restore | One workspace, one owner; no realtime team collaboration |
| Editor | Text, headings, lists, tasks, toggles, quotes, callouts, code, raster images, file links, simple tables, columns, linked pages, formatting, stable block IDs, block movement, duplication, delete, undo/redo | Block actions/reordering operate on top-level document blocks, including whole list groups. Columns and tables are basic; no arbitrary HTML embeds, synced blocks, advanced media widgets or full Notion block compatibility |
| Appearance | Quiet Notion-style shell, editable emoji icons, covers, original Jotstead mark, default/serif/mono fonts, width, text size, light/dark/system themes | Based on official public reference images; no exact full-product parity claim |
| Databases | Row pages; text, number, select/status, multi-select, date, checkbox, relation, formula and rollup properties | Relations are one-way page references; no automatic reciprocal relation or arbitrary formula syntax |
| Views | Saved table, board, gallery, list, monthly calendar, milestone timeline, status-count chart; shared filters, one saved sort, grouping | Filters use AND; timeline displays single-day milestones, not duration/Gantt scheduling; chart counts pages rather than arbitrary chart measures |
| Formulas | Bounded parsed expressions, property references, arithmetic/comparison/logical/conditional operations and small function library | Not Notion Formula 2.0. Unsupported expressions show `#ERROR`. No JavaScript execution |
| Rollups | Count, sum and average across related rows | Selected related property only; cyclic calculations show an error |
| Saving | SQLite transactions, revisions, serialized autosave, idempotent retry IDs, offline draft storage and explicit conflict decisions | Saves the canonical workspace snapshot; intended for a personal-size workspace and one server |
| Recovery | Separate device draft per tab, recovery list/export, explicit server/draft choice; page document history; trash | History restore preserves live schema, views, position and sharing settings. It does not rewind database property schemas or whole-workspace state. Device storage can be cleared by browser settings |
| Transfers | Full workspace JSON; Markdown document export; CSV database export; validated JSON replacement; basic Markdown and CSV append imports | JSON excludes attachment bytes and history. Markdown loses unsupported formatting/blocks. CSV imports fields as text and excludes row document bodies |
| Uploads | Server filesystem, 20 MiB files, detected PNG/JPEG/WebP/GIF images; other files download with safe headers | No object storage service, attachment indexing, virus scanning or offline attachment cache |
| Publishing | Explicit single-page reader route; unpublish; public database submission form | No workspace payload, existing database rows, child pages or comments in public output. Attachments referenced by a published page are readable until unpublishing. Public forms are rate limited |
| Comments | Owner page comments with delete | Personal notes rather than threaded team discussion/mentions |
| Automations | An edited property matching a value sets another supported typed field on that row, once per edit | No scheduler, email, webhooks, external integrations or cascading rule chains. Incompatible/stale targets are ignored |
| AI | Optional compatible server provider, selected page context, lexical workspace retrieval and source links; review and append output | Disconnected by default. Requires a configured provider or local model. No autonomous editing, semantic embeddings, binary file RAG or bundled model |
| API / agents | Authenticated workspace/history API; local stdio MCP with eight read/write tools and revision checks | MCP grants trusted clients owner-level local disk access; no per-agent permission model |
| Apps / offline | Manifest, original regular/maskable/Apple icons, production service worker, cached shell and previously visited static components, device drafts | Physical iOS/Android/desktop installation not exercised here. Localhost is device-specific; a phone needs a reachable HTTPS host for the same server. New lazy components/files need a connection |
| Delivery | Locked dependencies, Node 24 standalone production runner, CI template, container recipe, persistent data directory, backup utility and restore test | GitHub credential lacks workflow permission, so CI is supplied as a template. No remote host/domain was provisioned. Docker is supplied but not run on this machine |

## Formula functions

See `src/features/databases/formula.ts` for the exact supported function/operator list and evaluation budget. Property references use `prop("Property name")`; for example `prop("Effort") * 2`. Renaming a property can require updating expressions that refer to its old name.

## Resource limits

Canonical workspace state: 5 MiB. HTTP/import envelope: 6 MiB. Pages: 2,000. Database properties: 100. Views per page: 30. Document nesting depth: 32. Files: 20 MiB. These are technical protections for a personal server, with no paid unlock. History and uploads consume disk; back up both independently.
