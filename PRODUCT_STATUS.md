# Product status

**Updated 19 October 2026.** This page distinguishes code, tests, actual usage and release claims. Treat unverified surfaces as unfinished. Source of the current task: the Jotstead durability/local-first engineering brief.

| Capability | Implemented | Verified in this change | Production/user accepted |
| --- | --- | --- | --- |
| Pages, nested navigation, blocks, database views | Existing code and prior UI evidence | Not repeated end-to-end | Not demonstrated |
| Server revision checks, IndexedDB drafts and reconnect recovery | Existing code and tests | Not repeated end-to-end | Not demonstrated |
| Public page / file scoping, forms, auth and CSRF checks | Existing code and tests | Static review only; no new runtime penetration suite | Not demonstrated |
| Optional ChatGPT / compatible AI with selected-page context | Existing code | Static review only; no paid/provider calls | Not demonstrated |
| Version 2 complete upload inventory and independently checked SQLite backup | Implemented on this branch | Local isolated SQLite/attachment smoke checks passed | Not demonstrated |
| Safe restore dry-run and fresh-directory restore | Implemented on this branch | Local isolated restore/corruption checks passed | Not demonstrated |
| HTTPS/Docker self-hosting | Instructions and Docker files exist | Not deployed in this run | Not demonstrated |
| Installable PWA | Existing manifest/service-worker | Not tested on physical iPhone/Android | Not an App Store/native release |

## Delivery focus and acceptance

**Decision:** Prioritise data safety over a speculative UI redesign. Previously, a backup used a SQLite snapshot and an unchecked, potentially concurrent upload-directory copy. No attachment manifest, corruption verification or safe restore CLI was present.

Acceptance for this change: (1) existing data and history survive snapshot/restore, (2) every attached byte and metadata file is inventoried, (3) truncated/tampered files and unsafe paths are rejected, (4) dry runs never change destination data, (5) restoration never overwrites existing data, and (6) backup failures do not expose partial final directories.

## Checks and evidence

- **Executed here (isolated Node 22 Linux runtime):** TypeScript strict compile of the standalone backup script using locally available Node type declarations; passed.
- **Executed here:** `node --experimental-strip-types tests/backup-smoke.mjs` against disposable SQLite data: snapshot/revision/history, attachment equality, CLI verification, dry-run, restored data, existing-destination refusal, unsafe path aliases, tampered upload rejection and symlink rejection; **passed**. The exact two remotely committed implementation/smoke file blobs matched the locally executed copies.
- **Added to repository:** `tests/backup-integrity.test.ts` for the permanent Vitest suite. This suite was **not run** in this environment.
- **Blocked for full suite:** repository requires Node >=24, pnpm 11.19.0 and dependency installation. The isolated runner only provides Node 22 and cannot resolve github.com/registry hosts for cloning or installation. Do not claim `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm verify:http`, a full browser walkthrough, or GitHub Actions as passing in this run.
- Prior project screenshots and validation reports remain in `docs/`; they are not new evidence.

## Privacy, security and recovery

Backup output contains all workspace content and upload bytes. It should be encrypted at rest by the operator, stored offsite and never committed to Git. Auth/vault material is deliberately excluded. Restores write only to a fresh destination. SQLite and the upload filesystem are not jointly transactional: **stop writers before backup**. See [backup operations and limitations](docs/BACKUP_RECOVERY.md).

## Ranked remaining work

1. **P0 — Complete checkout verification:** On a Node 24 runner install locked dependencies, run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm verify:http` and production HTTP security checks against disposable data. Run restore tests against a real seeded Jotstead store; fix regressions before general release.
2. **P0 — Real backup coordination:** Introduce a cross-process, application-enforced maintenance/read-only mode for backups if zero-downtime snapshots are needed; prove interrupted uploads/reconnect attempts cannot race an archive.
3. **P1 — Public/private security:** Add adversarial HTTP tests for published database children, unpublished attachments, form scope, cross-origin writes, token/session edge cases, model-page scoping and MCP file access.
4. **P1 — Dogfood journeys:** Time complete create/search/edit/drag/drop/import/export/offline/reconnect/mobile workflows in real desktop/mobile browsers. Fix friction found in those measurements; avoid unmeasured rendering redesigns.
5. **P1 — Deployment acceptance:** Restore in a single-server HTTPS Docker setup and restart it; inspect filesystem persistence. Physically test iOS Safari home-screen installation, Android PWA and network interruption.
6. **P2 — Optional AI polish:** Improve source attribution, explicit data/cost disclosure, and reviewed diff-style edits without sending unrelated workspace content. Provider tests must use owner-authorised credentials.

## Release conclusion

**Not independently release-certified.** This branch improves a bounded recovery component but does not establish complete product readiness, real-phone use or production deployment acceptance. No paid API calls, deployments or user data changes were made.
