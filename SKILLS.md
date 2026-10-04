# Skills used for Jotstead

The requested [Vercel Find Skills workflow](https://skills.sh/vercel-labs/skills/find-skills) was used to search planning, Tiptap, UI review and visual verification candidates. Sources were read before project installation; `skills-lock.json` records selected content hashes. Installed skill directories are local tooling in `.agents/skills` and are excluded from application/runtime builds.

| Development aspect | Guidance applied | Result |
| --- | --- | --- |
| Requirements and scope | [brainstorming](https://skills.sh/obra/superpowers/brainstorming) | `docs/SPEC.md`: personal owner, persistent data, web/PWA platform, feature boundaries |
| Implementation planning | [writing-plans](https://skills.sh/obra/superpowers/writing-plans), executing-plans, finishing-a-development-branch | Concrete tasks in `docs/superpowers/plans/2026-10-04-jotstead.md` and execution ledger; user's autonomous handover replaces further approval gates |
| Closest UI | Installed Product Design image-to-code and design-qa | Official Notion help screenshots, matched editor fixture, desktop/mobile/dark/menu captures and comparison report |
| Branding and app icons | Built-in imagegen and Product Design asset workflow | Original folded/home-like J mark, inspected at large and favicon sizes; regular, maskable and Apple icon assets |
| Rich editor | [Official Tiptap skill](https://skills.sh/ueberdosis/tiptap/tiptap) | One editor hook, stable IDs, custom extensions, SSR-safe loading, real saved document JSON |
| React and loading behavior | [Vercel React best practices](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) | Dynamic editor loading, shared queries, focused state and bounded rendering; no second editor state store |
| Interaction/accessibility | [Web Design Guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) | Fresh official guideline snapshot in `docs/interface-guidelines.md`; focusable tree controls, named fields, native modal focus/escape, skip link and reduced motion |
| Web/PWA/server | Installed Vercel Next.js guidance and current bundled Next documentation | App Router endpoints, public projections, manifest, standalone server and offline shell |
| Data/database semantics | Scoped specification, current Node/SQLite documentation and canonical Zod schemas | Transactions, revisions, typed values, shared views, formula parser, resource bounds and regression fixtures |
| Testing and visual inspection | Existing computer/browser tools; Vitest, Happy DOM, real stdio MCP and production HTTP checks | Browser workflows, saved screenshots, offline interruption/reconnect, automated tests and a fresh whole-release review |
| Deployment and recovery | Current Next self-hosting/PWA documentation and project-specific checks | Standalone runner, Docker recipe, backup command, independently reopened backup test and delivery docs |

A skill package was not added for every noun. Skills improve execution; implementation-specific tests prove behavior. Browser functionality was already available, so a second agent-browser installation was unnecessary. Generic frontend-design candidates were assessed, but the pinned Notion references took precedence over a new design direction.

The fresh release reviewer identified recoverable-draft collisions, history/schema restoration, duplicate references, table attribute bounds and import/export limits. Those findings were fixed with regression coverage. Browser testing additionally exposed slash-menu render churn and a development hot-reload error-identity issue; both were corrected.

No skill or install count certifies pixel-perfect fidelity or full Notion parity. Actual coverage and evidence are recorded in [FEATURES.md](docs/FEATURES.md), [VALIDATION.md](docs/VALIDATION.md) and [design-qa.md](docs/design-qa.md).
