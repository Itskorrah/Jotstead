# Recommended skills for Jotstead

Researched 3 October 2026 using the requested [find-skills workflow](https://skills.sh/vercel-labs/skills/find-skills), the skills.sh leaderboard, CLI searches, skill content, and source repositories. CLI searches ran through `pnpm dlx skills` using the bundled runtime because `npx` was not on this shell's PATH.

Searches: `visual regression`, `tiptap`, and `writing plans`. Popularity numbers below are approximate directory snapshots, not a quality score or guarantee. Prefer task fit and maintainers' source material over install count.

## Core shortlist

| Skill | Source and approximate installs | Role | Why it fits |
| --- | --- | --- | --- |
| [brainstorming](https://skills.sh/obra/superpowers/brainstorming) | obra/superpowers; 384K | Requirements and subsystem design | Forces the large wishlist into defined outcomes and manageable specs |
| [writing-plans](https://skills.sh/obra/superpowers/writing-plans) | obra/superpowers; 267K | Implementation planning | Converts a scoped spec into concrete files, steps and validation |
| [tiptap](https://skills.sh/ueberdosis/tiptap/tiptap) | ueberdosis/tiptap; 3.3K | Block editor integration | Official maintainer skill; covers setup, extensions, document features and debugging |
| [vercel-react-best-practices](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) | vercel-labs/agent-skills; 767K | React performance review | Helps keep the editor, page tree and large database views responsive |
| [web-design-guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) | vercel-labs/agent-skills; 695K | Interaction and accessibility review | Checks keyboard access, focus and interface behavior alongside visual matching |
| [agent-browser](https://skills.sh/vercel-labs/agent-browser/agent-browser) | vercel-labs/agent-browser; 1M | Browser capture and interaction checks | Useful for reference collection and reproducible verification; an equivalent browser capability is already available here |

Source-quality checks: the directory links these skills to their named repositories, and reports substantial adoption. Its source repositories report approximately 294K stars for obra/superpowers and 32K for vercel-labs/agent-skills. Tiptap's repository was checked directly and reports approximately 38.6K stars. The official editor skill was read directly from `.agents/skills/tiptap/SKILL.md` through GitHub's contents API.

The planning skills are recommended for subsequent scoped execution. They were researched in this turn rather than invoked as an implementation workflow. Follow each skill's actual stage requirements when it is used. Avoid loading the entire Superpowers package simply to accumulate process.

## Closest-UI workflow already available here

The installed Product Design plugin provides `image-to-code` and its internal `design-qa` workflow. These are particularly relevant because they require a selected visual reference, measurement, working interactions, and comparison at the same viewport/state.

Use them for the visual layer of this project, with the requested production behavior explicitly in scope. No new frontend design direction is needed: the target is the captured Notion workspace. A public URL that opens a marketing page is insufficient evidence for the logged-in app.

Pair this workflow with actual references and a reviewed screenshot comparison loop. No skill alone can certify an exact reproduction. Browser capability is already available, so another browser package is not automatically necessary.

## Secondary candidates

- [frontend-design](https://skills.sh/anthropics/skills/frontend-design), approximately 949K installs, official Anthropic source: strong general implementation guidance. Its current source explicitly says to follow a pinned visual brief exactly. For Jotstead, apply that exception and reference measurements; its normal emphasis on distinctive new aesthetics is secondary to fidelity.
- [webapp-testing](https://skills.sh/anthropics/skills/webapp-testing), approximately 170K installs, official Anthropic source: useful for local browser testing and server lifecycle helpers. Add when it provides something missing from the existing browser verification setup. Its source uses Python Playwright scripts.
- Screenshot-diff search returned `software-mansion/argent`, Meticulous, and several smaller packages. These require additional fit/tooling assessment and were not selected over the reference-comparison workflow already available here.
- The Tiptap search also returned several third-party skills with fewer than 500 installs. The maintainer's official skill is the stronger initial choice for this editor.

Skills should be applied at their relevant stage. Multiple design-direction skills at once can pull the implementation away from the chosen source. Planning, UI matching, editor integration, and regression testing have different jobs.

## Optional project installation commands

The following commands are a reproducible shortlist, not a record of installations performed. No third-party skills were installed into the repository or globally during this planning turn. The skills CLI itself was fetched to a package-manager cache to run discovery.

```bash
npx skills add vercel-labs/skills --skill find-skills
npx skills add obra/superpowers --skill brainstorming
npx skills add obra/superpowers --skill writing-plans
npx skills add ueberdosis/tiptap --skill tiptap
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
```

If needed, add the browser/testing capabilities separately:

```bash
npx skills add vercel-labs/agent-browser --skill agent-browser
npx skills add anthropics/skills --skill webapp-testing
```

Review source content before installing and pin the selected source revisions when setting up the project. Installing a skill does not install or implement the application's features.

## Source material reviewed

- [Find Skills source](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md).
- [Brainstorming source](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md) and [Writing Plans source](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md).
- [Official Tiptap skill](https://github.com/ueberdosis/tiptap/blob/main/.agents/skills/tiptap/SKILL.md) and [Tiptap repository](https://github.com/ueberdosis/tiptap).
- [Vercel React guidance](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) and [Web Interface Guidelines skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md).
- [Anthropic Frontend Design source](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) and [Webapp Testing source](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md).
- Installed Product Design `index`, `user-context`, `image-to-code`, and critical-override instructions were read locally. No application UI was implemented in this turn.
