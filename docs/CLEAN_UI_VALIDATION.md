# Clean UI validation

The redesign uses Impeccable for the visual system, Emil Design Engineering for interaction details, Mobile Native for responsive behavior, Vercel React/composition guidance for implementation, and Web Design Guidelines plus behavioral tests and an actual browser walkthrough for verification. Skills were discovered through Vercel find-skills and recorded in skills-lock.json.

## Before and after

| Surface | Before | Delivered behavior |
| --- | --- | --- |
| Home | Opens the onboarding document | Recent pages, favorites, page/database creation and templates |
| Sidebar | Duplicate strong selection, expansion on leaf pages, repeated root creation | One dominant tree selection, quiet favorite shortcuts, meaningful expansion and one primary root action |
| Database | Oversized heading and seven competing tabs | Compact icon/title, three primary views, picker for every additional view |
| Table | All columns always compete for space | Persisted per-view column visibility; fields remain accessible |
| Board | Repeats grouped status and column creation | One column creation action; no redundant group metadata |
| Properties | Inconsistent date and edit presentation | Shared controls and readable date labels across table/detail/cards |
| Page icons | Platform-dependent colorful emoji | Consistent monochrome vectors and searchable 57-icon picker; legacy values remain stored |
| Editing | Block menu persists, task controls overlap checkbox | Escape/outside dismissal and separate block-control gutter |
| Recovery | Unexpected sign-in interruption | Session explanation with draft/destination preservation |

## Verification

`pnpm check` passed: 78 tests in 18 files, TypeScript, optimized production build, and production HTTP verification. The HTTP checks cover password protection, CSRF, revisions, invalid data, upload privacy, publication/unpublication, forms, history, AI status, manifest and sign-out.

The browser walkthrough used a disposable isolated workspace at port 3004; it did not alter the user's primary notes. Verified flows include Home/navigation, search/Enter navigation, favorites, block commands and task checkbox persistence, menu Escape/outside dismissal, database search/filter/sort, all seven views, row creation, status/tags/effort/date edits, column visibility persistence, icon search/selection, template creation, cover selection, comments, project briefs, manual ChatGPT capture, duplication, trash/restore, settings sections, light/dark appearance, Markdown file import with preview, sharing dialog/private-link copy, and disconnected AI recovery.

The date edit regression was reproduced with a native input value change before an input event, then fixed and checked in the actual browser. The task-checkbox overlap was observed through the real click and DOM hit target, then corrected and rechecked; the checked task persisted after navigation and reload.

Screenshots use 1280×900 desktop and 390×844 mobile viewports. The compact desktop table begins around 216px below the top. Captures: [light table](screenshots/clean-ui/projects-desktop.png), [dark table](screenshots/clean-ui/projects-desktop-dark.png), [dark board](screenshots/clean-ui/board-desktop-dark.png), [icon picker](screenshots/clean-ui/icon-picker-desktop.png), [Home](screenshots/clean-ui/home-desktop.png), [mobile table](screenshots/clean-ui/projects-mobile.png), [mobile board](screenshots/clean-ui/board-mobile.png), [mobile detail](screenshots/clean-ui/detail-mobile.png), [mobile Home](screenshots/clean-ui/home-mobile.png), [mobile editor](screenshots/clean-ui/editor-mobile-dark.png), [mobile settings](screenshots/clean-ui/settings-mobile-dark.png).

## Practical limits

- Existing custom fields, page IDs, notes and stored icon values are preserved. Fresh examples use Status as the only completion source and label effort in points; existing Complete fields are not silently deleted or rewritten.
- The export action was clicked without a console error, but the in-app browser did not expose its download event. A saved-file download was not confirmed by browser automation. Import/export transformations are covered by automated tests.
- Responsive web/PWA layouts were exercised. Physical iOS/Android devices, native app-store binaries, OS keyboard behavior and browser installation prompts were not tested.
- Live ChatGPT sign-in still requires a valid upstream OAuth client; this redesign does not fix `invalid_client`. Live Claude/Gemini/model execution was not exercised. Disconnected states and existing protocol/HTTP tests were checked.
- No exhaustive claim is made for every possible database property, attachment type, external account or configuration combination.

## Independent review

The fresh reviewer required two material fixes: live linked-page node views must retain the marker used for client navigation, and formatting/history controls must subscribe to editor state. Both were reproduced with failing real-editor integration tests and fixed. The final suite now passes **81 tests in 19 files**, plus typecheck/build/production HTTP. External document updates also have a regression check; initialization no longer creates a phantom Undo operation.

One minor follow-up is deferred: pressing Enter on a changed tag field and immediately blurring can dispatch the same idempotent update twice. The review did not establish tag corruption. Live provider, physical-device, download completion and unrelated-backend judgments remain subject to the limits above.

The final reviewer scored both material fixes resolved and returned `ship` for those fixes. The design/code review did not establish capabilities excluded by the practical limits.
