# Validation evidence — 4 October 2026

Validated on macOS with Node 24.19.0, pnpm 11.19.0, Next.js 16.3.8 and the Codex in-app browser. Tests use isolated temporary storage; the visible preview uses the ignored `data/` directory. No real user workspace or provider account was imported.

## Automated checks

- `pnpm test`: **37 passing tests in 10 files**. Coverage includes tree cycles and moves, persisted SQLite restart, stale-write rejection/retry, auth/session/origin boundaries, numeric/date queries, formula safety/rollups, typed rule execution, transfer roundtrips and large valid exports, public projection/upload bounds, independent backup restore, subtree reference duplication and history schema preservation.
- Autosave hook tests verify corrected edits after rejected requests, edits during an in-flight save, conflict recovery when its first fetch fails, separate offline tabs, and atomic recovery archiving that preserves a newer edit in another tab.
- A real stdio MCP client launches the server, lists eight tools, searches, creates/reads a persisted document, queries a database, rejects a stale mutation and moves a page to recoverable trash.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; standalone output contains the web page, manifest, authenticated API and isolated public page/form routes.
- `pnpm verify:http`: passed against an actual built production process on an ephemeral loopback port, with disposable password and storage. Checks anonymous denial, wrong/correct password, cookie attributes, CSRF rejection, valid save, HTTP 409 for stale revision, invalid state rejection, raster upload detection, private attachment denial, publish/read/unpublish, public form submission, history, disconnected AI status, manifest and sign-out.
- `pnpm audit --audit-level=high`: no known vulnerabilities found. An initial sharp dependency finding was addressed by using the patched production dependency.
- The GitHub Actions template in `docs/ci/github-actions.yml` repeats tests, typecheck, build, production HTTP checks and audit on push/PR once enabled. GitHub rejected the initial push because the connected credential lacks `workflow` permission. To deliver the app without expanding account access, the template is supplied outside the active workflows directory. All checks above ran locally; no remote CI run is claimed.

## Real browser workflows

| Workflow | Observed result |
| --- | --- |
| Create a page, type a title/body, use `/todo`, check the task, reload | Title, document and checkbox survived reload; save status reached Saved |
| Add a child through keyboard-accessible tree actions | Nested page, breadcrumb and parent navigation appeared correctly |
| Editor image upload through the file chooser | Original test icon appeared using a stored `/api/uploads/<id>` URL and persisted |
| Move a block up; invoke editor undo | List group moved before the heading, then returned to its original order |
| Edit database title/status/number and a row document | Table/board/row page reflected the same changed row; saved in server storage |
| Table, board, gallery, list, calendar, timeline and chart | All rendered the shared fixture; Done count changed to three; calendar/timeline showed dated rows |
| Filter status to Done; sort Effort numerically | Filter showed only the three matching rows; sort put smaller numbers first |
| Row page actions/font menu | Menu stayed usable inside the modal; serif setting applied |
| Comments and version restore | Comment appeared; prior document restored; current version remained in server history |
| Malformed JSON import | Validation rejected the content before any replacement; workspace remained available |
| Publish a synthetic local page and inspect reader route | Only selected title/document appeared; sidebar, nested page, comments and workspace settings were absent; then unpublished |
| Submit a synthetic public form | Confirmation reported saved; owner recovered the newer server version and saw the additional private row |
| Stale owner save after form submission | Conflict controls preserved the local draft and let the owner keep the newer server response |
| Production server interruption | After confirming server unavailable, a new title could be edited and kept locally |
| Reopen while server unavailable | Service worker served shell; IndexedDB restored the title/body/task and displayed Offline with export/retry controls |
| Restart and reload | Automatic retry saved the offline change; another reload showed Saved and the same title |
| Trash and restore | Synthetic fixture disappeared into Trash and returned through Restore; child recovery is covered by the tree tests |
| Device draft review | Recovery list opened; recovered copy and server choice worked; resolved banner cleared on reload |
| Light/dark, desktop and 390 px viewport | Legible layouts, mobile navigation overlay, scoped horizontal database scrolling; document width equaled viewport width without outer overflow |
| Install information | Manifest/icons present; supported-browser and Safari instructions visible in Settings |

Browser testing found and fixed a slash-menu state-update loop, modal menus behind the dialog layer, and development hot-reload conflict-class identity. Each observed error was corrected and the affected workflow rechecked. The final production tab had no error/warning entries before delivery. Expected failed fetches during the deliberate offline test are not normal-operation errors.

## Visual evidence

See [design-qa.md](design-qa.md) and `docs/screenshots/`. The editor reference comparison uses matching synthetic content at a 960 × 600 logical viewport. Desktop captures use 1440 × 900; mobile captures use 390 × 844. Public Notion help assets are the reference baseline, not access to a private current Notion account.

## Practical boundaries

The website and installable PWA share one implementation. Actual desktop installation, physical iPhone/Android installation, virtual keyboards, native signing/app store delivery, Docker execution, real AI generation and remote HTTPS hosting were not exercised on this machine. They are not claimed as tested. No separate native binaries, domain, remote server or paid provider was provisioned. JSON/Markdown/CSV export content is covered automatically; the browser download-event wait was unavailable in this in-app browser, so an actual browser-saved export file is not claimed as inspected.

The production HTTP suite tests API publication/privacy on an isolated password-protected server; the visible browser preview binds only to loopback and deliberately uses local-only mode. See README before exposing the app remotely.

## ChatGPT integration — 4 October 2026

`pnpm check` passed: **65 tests in 17 files**, TypeScript, optimized Next production build and isolated production HTTP verification. `pnpm audit --audit-level=high` reported no known vulnerabilities. OAuth tests use locally signed fixture identities, never a real user credential. New production HTTP checks verify capture revision conflicts/retry idempotence, CSRF, unauthenticated AI-consent denial and forged callbacks. MCP roundtrips exercise both TypeScript source and the actual portable bundle.

Browser verification used the production app on loopback and disposable data on port 3001. Created/edited/persisted a shared brief, saved a selected excerpt with its H1 heading and clickable source, waited for Saved, reloaded and verified persistence, verified disconnected AI messaging, and checked login/brief forms at **390 × 844**, with no horizontal overflow. The MCP Apps test host on port 3002 was explicitly labeled as isolated protocol QA; it connected to the actual bundled stdio runtime, rendered a selected shared brief and persisted a selected save to Notes through the standard bridge. It is not a live ChatGPT account or native-host test. A packaging defect found in that browser pass (JavaScript replacement-string expansion) was reproduced with a failing script-syntax test and fixed. A hidden database append and non-clickable source attribution were likewise reproduced and fixed.

A fresh independent whole-branch review found disconnect callback restoration and unauthenticated legacy password migration; reproducing tests failed before fixes and passed after. Captured leading-heading loss was treated as content loss and fixed. An additional refresh snapshot race and real-editor source-link autosave failure were also reproduced RED→GREEN. The final suite passes 65 tests, TypeScript, production build and HTTP checks. No second review is claimed. Installed plugin version **1.1.1** matches the built bundle by SHA-256. A portable private archive contains compiled runtime/UI and dependency notices, with no workspace or authentication data.

Screenshots: `chatgpt-connections.jpg`, `chatgpt-mobile-connections.jpg`, `chatgpt-login.jpg`, `chatgpt-mobile-login.jpg`, `chatgpt-shared-brief.jpg`, `chatgpt-mobile-brief.jpg`, `chatgpt-saved-selection.jpg`, `chatgpt-plugin-panel.jpg`, `chatgpt-plugin-save.jpg`. Native ChatGPT host loading awaits a host reload; OpenAI login, live plan inference and remote revocation await the user's interactive consent. No remote deployment, physical mobile installation or remote CI run is claimed.

## Sign-in layout cleanup — 4 October 2026

Used find-skills discovery and Vercel Web Design Guidelines for the bounded sign-in cleanup. The page now uses one centered 380px column, a compact brand row, consistent spacing, a full-width action and shorter supporting text. Draft recovery has its own separated footer; password fields fit the same column.

`pnpm typecheck` and `pnpm build` passed. Browser verification covered the actual production dark sign-in at desktop and 390 × 844 mobile, with no horizontal overflow. An isolated preview of the same component covered light mode, the legacy password form, draft recovery and visible keyboard focus. No live OpenAI login was performed. Screenshots: `chatgpt-login.jpg`, `chatgpt-mobile-login.jpg`, `sign-in-layout-dark.jpg`, `sign-in-layout-mobile-legacy.jpg`.
