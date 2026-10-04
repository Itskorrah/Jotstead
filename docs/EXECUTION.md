# Execution ledger — plan: docs/superpowers/plans/2026-10-04-jotstead.md

Ruling: execute inline using writing-plans/executing-plans with one final independent review. User already authorizes all decisions and implementation without further approval.
Ruling: SQLite replaces proposed PostgreSQL for personal single-host release; avoids external service provisioning. Cost: single-server deployment, no team-scale DB.
Ruling: first empty repository bootstrap on main authorized by explicit instruction to add finished code to the empty GitHub repository. Task commits remain locally reviewable.
Pre-flight: model types and updateWorkspace feed editor/database/imports; all use the same Page and Workspace canonical state. Public routes return a projection, never Workspace.

Task 1 complete: validated canonical state, SQLite transactions/restart, revision/retry and auth/origin checks. Initial implementation commit: a814ef9.
Task 2 complete: shell, nested pages, stable rich editor, serialized saves/recovery, history, settings and keyboard controls. Browser create/nest/edit/task/upload/reload and block movement/undo rechecked.
Task 3 complete: shared database query layer, typed row pages, seven views, formulas/relations/rollups, filters/sort and simple typed rules. Browser shared-state checks and semantic fixtures passed.
Task 4 complete: safe uploads, public projections, forms, history boundary and optional configured AI. Actual production HTTP password/CSRF/upload/privacy/publication/form checks passed. Provider-disconnected state is honest; no provider account provisioned.
Task 5 complete for implementation/validation: PWA shell, original icons, transfers, independent backup/restore, standalone runner, Docker recipe, CI and reports. Browser offline interruption/reopen/reconnect succeeded. Physical app installation and Docker run remain unverified as recorded in VALIDATION.md.

Fresh whole-release review performed by release_review. Important findings fixed: per-tab draft separation, atomic archive protection against newer concurrent draft writes, history restore preserves live schema/sharing, subtree duplicate remaps internal links/relations, canonical storage and import/export byte limits, bounded table attributes, corrected edit/retry and conflict-fetch recovery. Regression suite: 37 tests in 10 files, plus real production HTTP suite. Minor rule path consistency addressed for updates and typed target guards; no cascade/scheduler promised.

Browser findings fixed: slash-menu update loop, dialog menu stacking, hot-reload conflict-error identity, solid-color card covers and measured editor spacing. Final source/implementation evidence in design-qa.md. Deliberate offline errors distinguished from production runtime errors.

Ruling: apply finishing-a-development-branch validation/delivery guidance. User explicitly delegates all decisions and authorizes GitHub delivery without further confirmation; bootstrap main in verified empty repository rather than ask for integration menu. No force push, no worktree deletion, preserve local data outside Git. Final clean suite/build/HTTP/audit precedes push; verify remote SHA afterward.

Delivery finding: GitHub rejected the first push because the connected OAuth credential has repo permission but not workflow permission; the existing SSH agent has no identities. Preserve the complete CI configuration as `docs/ci/github-actions.yml`, update the documentation, and amend the unpublished release commit before a normal push. Do not expand account permissions or claim a remote CI run. All equivalent checks passed locally.
