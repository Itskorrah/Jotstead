# ChatGPT release review

Release 1.1.1, 4 October 2026. One fresh independent whole-branch review covered the phase-2 implementation; the implementer resolved the findings in one test-driven fix pass. Final validation: 65 tests in 17 files, TypeScript, production build and real HTTP checks. Audit reported no known vulnerabilities. Desktop/mobile and MCP Apps bridge screenshots are in `docs/screenshots/`.

## Findings and disposition

- Important: pending and already-exchanging callbacks could restore credentials after disconnect. Fixed with transactional authorization generations, pending-attempt invalidation and final connection checks; sign-out also cancels attempts.
- Important: first ChatGPT binding bypassed an existing workspace password. Fixed with prior password-session authentication and a migration proof bound to the attempt and validated before code exchange.
- Initially Minor, regraded Important: captured leading H1 disappeared. Fixed for both append and create while preserving ordinary Markdown-import title extraction.
- Additional Important: split token/version reads could accept a renewal from a superseded authorization. Fixed with an atomic SQLite snapshot and compare-and-replace.
- Browser-discovered Important: Tiptap's link-title normalization blocked attributed-capture autosave. Fixed with bounded link-title validation and an actual editor roundtrip test; browser Saved/reload persistence verified.

All five reproductions were observed failing before their fixes, then passing. No Critical finding and no remaining deferred Minor finding. No second independent review is claimed.

## Decisions made

1. The user's explicit autonomous one-pass authorization superseded repeat approval prompts. Cost if wrong: scope assumptions are recorded in the spec.
2. Missing sibling planning helper scripts were replaced with a manual ledger and actual command evidence. Cost if wrong: less automated bookkeeping.
3. The API-key provisioning gate does not apply to subscription OAuth; no key was created. Cost if wrong: API-key access remains unconfigured.
4. Leading-heading loss was regraded Important because selected content must survive. Cost if wrong: a small importer option and two tests beyond the reviewer's grade.
5. Live OpenAI login, consent, inference and revocation remain user-completed checks. Protocol/failure tests support code delivery. Cost if wrong: provider availability may require follow-up.
6. Native ChatGPT host loading needs a reload; supported installation and MCP Apps bridge tests verify the package, not that native host. Cost if wrong: host compatibility may require follow-up.
7. Physical PWA installation remains unverified; responsive browser checks support this change. Cost if wrong: device-specific behavior may require follow-up.
8. Remote deployment remains outside the approved loopback integration. Cost if wrong: remote access requires a separate registered authentication flow.

The release provides web/PWA clients and a personal local plugin. Automatic ChatGPT chat/project/memory mirroring, Claude/Gemini and separate native binaries remain deferred. No credential, private workspace, machine-specific runtime path or live authorization URL is included in source control or the portable private package.
