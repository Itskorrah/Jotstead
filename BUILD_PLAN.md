# Archived Jotstead build proposal

> This is the pre-implementation planning snapshot. Its future-tense statements describe the original proposal, not the current repository. The implemented architecture and verified release are documented in [README.md](README.md), [docs/SPEC.md](docs/SPEC.md) and [docs/VALIDATION.md](docs/VALIDATION.md). SQLite and an installable PWA were selected for this release.

Prepared 3 October 2026. Working name; naming availability is unconfirmed.

## Intended outcome

Build a personal website that closely reproduces Notion's workspace appearance and everyday interactions, with independently implemented pages, blocks, databases, and useful equivalents of paid features. Prioritize visual accuracy and reliable daily use. Keep the software usable without a mandatory subscription.

The referenced “Build Notion Copy” chat supplies the feature wishlist. It is not a tested specification. The current repository is empty apart from Git metadata. This document is a proposal and roadmap; no application has been built or visually verified yet.

Working assumptions: one owner, desktop browser first, light theme as the initial visual baseline, dark theme next, narrow-screen support, self-hosting as the default deployment path. Collaborative team use can follow. The sidebar should use Jotstead's name and original mark while the workspace follows the selected Notion reference closely.

## Feasibility and scope

A close visual recreation is achievable. The demanding work is editor behavior, consistent database semantics, saving and recovery, offline synchronization, permissions, and automation reliability. A sidebar, editable document, and attractive table do not establish parity with Notion.

Do not promise “95% identical” or “all premium features” before defining and verifying the screens and behaviors being compared. Freeze a reference version of the current desktop workspace and maintain a feature matrix. Visual accuracy and functional coverage are separate acceptance criteria.

No software subscription does not imply zero operating cost. Existing hardware can run the app locally; remote availability depends on a running host, network access, authentication, and backups. Storage grows with attachments and revisions. Hosted infrastructure, domains, electricity, and optional AI providers can cost money. Local AI also depends on available hardware and model quality.

## Name

**Jotstead** — **A home for your ideas.**

“Jot” makes the writing purpose clear; “stead” suggests a place you own. It works for notes, tasks, projects, and databases without sounding like a variation of Notion. Keep branding small and quiet within the workspace.

This is a working creative recommendation. Domain and trademark availability have not been established. Preliminary searches revealed existing note products named Folio and JotLoom, so those were passed over.

## Approach options

| Approach | Benefit | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Build our own app on established open-source editor and database tools | Full control over appearance, behavior, data, and deployment | Requires deliberate implementation of database and recovery features | Preferred for this request |
| Adapt an existing workspace product | Faster initial feature coverage | Existing architecture and styling may constrain fidelity; requires a separate license and maintenance assessment | Consider only if time becomes more important than exact appearance |
| Make a frontend demonstration | Fast way to evaluate visual accuracy | Does not provide durable storage or a usable personal workspace | Useful first checkpoint, followed immediately by real persistence |

## Skills workflow

See [SKILLS.md](SKILLS.md) for researched sources, popularity evidence, caveats, and installation commands.

Use a small set at each stage:

1. Planning: `brainstorming` to resolve requirements, then `writing-plans` for one subsystem at a time.
2. Visual implementation: the already available Product Design `image-to-code` workflow and its `design-qa` comparison process, grounded in captured Notion references.
3. Editor: the official `ueberdosis/tiptap` skill.
4. Implementation review: Vercel React best practices and Web Interface Guidelines.
5. Verification: the available browser tools for capture and interaction checks; automated browser regression tests in the project when implementation begins.

These are stage recommendations, not a claim that all skills have been installed or executed. This turn used `find-skills` discovery and Product Design routing/context guidance. External candidates were read and evaluated. The roadmap below is not a code-level `writing-plans` output.

## Visual fidelity process

### Establish the reference

Use the actual logged-in Notion workspace UI, rather than the public marketing website. Reference capture requires an accessible Notion session or supplied screenshots. No logged-in screens have been captured in this planning turn. Public help pages can ground behavior but cannot replace that visual evidence.

Create matching sample content in Notion and Jotstead. Record browser, operating system, viewport, zoom, theme, sidebar width, page width mode, and reference capture date. Use desktop fixtures at 1440 × 900 and 1280 × 800, plus a narrow layout; adjust these to the actual supplied references.

Capture both resting and interactive states:

- Expanded/collapsed sidebar, page tree, favorites, hover and selected rows.
- Empty page, ordinary document, cover/icon page, full-width page, dark page.
- Slash menu, text selection toolbar, block menu, drag handle and drop target.
- Search, page actions, icon/cover picker, settings and trash.
- Database table, property editing, filters, sorting, board and gallery.
- Database row opened as a page, with properties and document content.

Store reference images and a state inventory in `docs/reference/`. Do not save private workspace content unnecessarily; use synthetic fixtures.

### Translate references into components

Measure sidebar and header geometry, page gutters, readable content width, font metrics, line heights, row heights, icon scale, border colors, corner radii, shadows, menu positioning, and hover backgrounds. Derive CSS tokens from the captures; proposed pixel values must remain labeled provisional until measured.

Build neutral primitives with controlled styles. Radix/shadcn can supply accessible behavior where appropriate, but their default styling must be adjusted to the reference. Select an open icon library by comparing representative icons rather than automatically choosing one. Use freely usable fonts that closely match the reference.

Preserve keyboard behavior and focus treatment while matching the screen. The editor's caret, text selection, Enter/Backspace behavior, paste handling, menus, and drag targets matter as much as colors and spacing.

### Compare and correct

Compare each reference with the implementation at the same viewport, theme, content, and interaction state. Use side-by-side images and overlays/diffs. Mask only dynamic details such as blinking carets or timestamps; do not mask real layout differences. Record measured mismatches and fix them in priority order.

Reference comparison establishes fidelity; snapshots of Jotstead alone catch future regressions. Both are needed. Avoid an arbitrary global percentage: image differences can reflect font rasterization rather than a meaningful UI problem. Every milestone should have reviewed evidence and a named list of remaining differences.

## Proposed architecture

| Area | Choice | Reason |
| --- | --- | --- |
| App | Next.js, React, TypeScript | One web application with a server and independently styled components |
| Styling and controls | Tailwind/CSS variables, Radix primitives where useful | Measured tokens and control over dense workspace UI |
| Editor | Tiptap's open-source core with custom extensions and node views | Headless editor lets us reproduce the selected appearance |
| Durable data | PostgreSQL with Drizzle migrations | Pages, typed database properties, relations, views, and revisions need an explicit model |
| Attachments | Local persistent volume first; storage adapter for later object storage | Self-hosting without a required hosted storage service |
| Search | PostgreSQL text search initially | Useful title/content search before adding semantic retrieval |
| Client state | Editor state plus minimal UI/query state | Avoid duplicating documents across competing stores |
| Testing | Unit/integration tests for data semantics; browser tests for workflows and appearance | Verify correctness and visual accuracy independently |
| Deployment | Containerized app and PostgreSQL on persistent volumes | Reproducible self-hosting; managed hosting remains optional |

Verify current stable package versions and licenses at implementation time; the old chat's version numbers are not the dependency lockfile.

[Tiptap is headless, built on ProseMirror, and distinguishes open-source components from paid extensions](https://tiptap.dev/docs/editor/getting-started/overview). Use open-source packages and implement our own history, comments, and AI integration as needed. Do not make a paid editor cloud service a hidden requirement.

Before committing to the editor schema, prove stable block IDs, nested toggles, node conversion, drag ordering, paste, undo, and save/load round trips in a small technical spike. Compare BlockNote only if it materially reduces work without compromising visual and behavioral control. Do not support two editor engines.

### Data boundaries

- A workspace owns pages, databases, attachments, and settings. Single-owner use still needs consistent access checks before remote deployment.
- A page has a stable ID, title, parent, icon/cover metadata, deletion state, and content revision. A database row is also a page.
- The editor owns one versioned document schema with stable block identifiers. Choose a canonical document representation in the editor spike; do not maintain an unrelated second block store.
- A database defines typed properties; values belong to its row pages. A saved view references the same database and stores presentation, filters, sorting, and grouping.
- Relations reference IDs rather than titles. Rollups and formulas need documented null handling, types, cycle behavior, and update semantics.
- Attachments use stable references. Revisions capture enough document and property state to restore a coherent page.

Database views must share one query/command layer. Editing a card in board view must update its table row and page properties. Notion's documentation provides a useful [reference for views, filters, sorts, and groups](https://www.notion.com/help/views-filters-and-sorts).

### Saving and recovery

Autosave should expose meaningful saving, saved, and failed states. Use revision checks to detect concurrent changes, retry failed requests safely, and retain recoverable drafts. Never silently overwrite a newer revision from another browser tab. Stable mutation IDs allow retries without duplicates. Use trash and restore rather than immediate deletion.

Run backups of both the database and attachment volume. Test restoring to a fresh instance before calling the first durable milestone complete. Snapshot history is useful but is not a substitute for an independent backup.

## Build order and acceptance gates

| Phase | Deliverable | Required evidence |
| --- | --- | --- |
| 0: References and editor spike | Screen/state inventory, measured tokens, feature matrix, tested editor schema | Captured reference evidence; save/load, paste, nesting, drag and undo probe passes |
| 1: Workspace shell | Page tree, sidebar, breadcrumbs, document frame, search/menu interactions | Same-state comparisons; keyboard navigation and responsive layout work |
| 2: First usable workspace | Create/nest/rename/move pages; text, headings, lists, tasks, toggles, quotes, callouts, code, links, images/files; slash commands and inline formatting | Create a page, edit/reorder blocks, navigate away, reload, reopen; content survives server restart; failed-save and recovery checks pass |
| 3: Database foundation | Typed properties, row pages, table, board, gallery/list, shared filters/sorts/grouping, templates | Same rows stay consistent across views; property type and filter tests pass; row edits persist |
| 4: Advanced workspace | Calendar/timeline, relations, rollups, scoped formula language, charts, backlinks, mentions, version restore, import/export | Known-result formula/rollup fixtures; timezone/date tests; revision restore; loss-aware import/export report |
| 5: Publishing and automation | Forms, public pages, optional custom domain, API/webhooks, trigger/action jobs and run logs | Private data is excluded from public output; permissions tested; retries do not duplicate actions |
| 6: AI and agent tools | Rewrite/summarize, workspace answers with source links, database suggestions, MCP page/database tools | Provider can be disabled; retrieval honors access; proposed edits can be inspected and reverted |
| 7: Offline and collaboration | Offline drafts and reconnect queue, conflict recovery, then optional multi-user editing/comments | Edit/reload offline, reconnect without loss, and test conflicting changes; test two clients if collaboration is included |

Phase 2 is the first useful release. It must look close to the selected Notion screens and persist real work. A static screenshot clone is an earlier checkpoint, not the finished product.

The architecture should reserve stable IDs, revisions, and retry-safe mutations early so offline support has a foundation. A PWA install button or service worker alone does not constitute offline editing. Add a CRDT collaboration layer only when simultaneous editing is an actual requirement; evaluate migration from the stored schema explicitly.

## Mapping the earlier wishlist

| Earlier request | Planned treatment |
| --- | --- |
| Unlimited pages, blocks, files, charts and history | No artificial subscription gates; capacity and configured retention remain finite |
| Columns, media, embeds and advanced blocks | Extend Phase 2 after the initial editor behavior passes; document/embed support varies by source |
| Calendar, timeline, formulas, rollups, subtasks and dependencies | Phase 4, each with its own behavioral specification; formulas begin with a defined subset |
| Forms, sites, custom domains, automations, API and webhooks | Phase 5; hosting/domain dependencies and external service limits remain real |
| AI writing, extraction, autofill, retrieval and agent editing | Phase 6; local provider first where practical, optional paid provider keys |
| Semantic search over pages/files | Add after text search and file extraction work; define supported file types and indexing rules |
| Offline/PWA, mentions, backlinks, search, templates and export | Spread across the durable workspace phases; offline synchronization is separate work |
| Imports from Notion | Start with exported Markdown/CSV/attachments; report unsupported items and broken relationships rather than imply perfect conversion |
| Meeting notes, enterprise search and third-party integrations | Separate later projects with explicit capture, connector and permission requirements |
| Enterprise administration and granular team permissions | Outside the personal first release; basic ownership and publication permissions remain required |

Do not enable buttons for unfinished capabilities. Build an end-to-end workflow before expanding the menu of features.

## First execution package

Once implementation is requested, begin with Phase 0 and the workspace shell. Produce a concrete implementation plan covering these proposed boundaries:

```text
src/app/                 routes and server entry points
src/features/workspace/  sidebar, tree, page navigation
src/features/editor/     schema, extensions, editor UI, persistence boundary
src/features/databases/  properties, row queries, views
src/components/ui/       measured shared controls
src/lib/db/              schema, migrations, transactions
src/lib/storage/         attachment interface
docs/reference/          screenshots, tokens, state inventory
tests/                   data invariants and browser workflows
```

Keep the first plan limited to reference capture, editor validation, shell, and durable pages. Database, AI, automation, and offline work each get their own subsequent plan. Verify each milestone with type checking/build checks, meaningful data tests, browser interaction checks, and reference comparison before describing it as complete.

The next useful input is a set of accessible Notion reference screens. The provisional baseline is the current desktop workspace in light mode, followed by its dark and narrow-screen equivalents. No exact visual-match claim can be verified without those references.
