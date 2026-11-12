# docs/ai - project knowledge for future development

This folder is the **source of truth for how Ledger Tracker works, what is wrong with it, and where it is going**. It exists so any contributor - human or AI agent - can start work without re-auditing the codebase. It began as a full audit on 2026-11-11 (commit `8b21342`) and was updated the same day after the vault, redesign and showcase work was implemented (uncommitted at the time of writing). [CURRENT-STATE.md §0](./CURRENT-STATE.md) is the current truth; §3–§4 there are the historic audit. Verification methods are in §7 of that file.

| File | Question it answers | Read when |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How does the system work *today*? (stack, encryption design, vault lifecycle, data layer, schema, routes, storage map, CSP, build/test) | before touching any code |
| [CURRENT-STATE.md](./CURRENT-STATE.md) | What is the baseline now, which audit findings are resolved, and what gaps and risks remain? | before fixing or building on an area; when a claim looks suspicious |
| [ROADMAP.md](./ROADMAP.md) | What is done, partial or open (§S), what must the owner confirm, what is "done"? | before planning or starting a task |
| [REDESIGN-AND-SHOWCASE.md](./REDESIGN-AND-SHOWCASE.md) | What should it look like, which pages/features to add, and what does the agency showcase need (A→Z)? Summary at the top. | before any UI, copy, feature or launch work |
| [GUIDELINES.md](./GUIDELINES.md) | How do I work here? (rules, commands, conventions, recipes, gotchas, doc upkeep) | before your first change |

Entry points elsewhere: [`/CLAUDE.md`](../../CLAUDE.md) (short brief for Claude Code) and [`/AGENTS.md`](../../AGENTS.md) (pointer for other agents).

## Conventions used in these docs

* **IDs:** `SEC-n` security/honesty · `DATA-n` integrity · `BUG-n` behaviour · `DEBT-n` tech debt (all in CURRENT-STATE §4) · `F-n` feature (REDESIGN §6) · `0.1`…`5.8` roadmap items · `D1…D8`, `P` owner decisions (ROADMAP §0). IDs are stable - never renumber; add new ones at the end.
* **Evidence:** `path:line` at the audited commit. If code moved, `grep -n` the symbol.
* **Verified vs proposed:** ARCHITECTURE and CURRENT-STATE §0 describe facts. ROADMAP §S records what was built. The rest of ROADMAP and REDESIGN is the original plan; decisions were applied at the recommended defaults on a blanket approval and are **provisional until the owner confirms them** (ROADMAP §S).
* **Sizes:** S / M / L / XL are relative effort, not dates.

## Status board

| Area | State |
|---|---|
| Audit & docs | done 2026-11-11; docs updated after implementation |
| Phases 0–2 (truth, data layer, real encryption) | **implemented**, uncommitted; 173 unit tests; browser-verified on a production build with the enforced CSP |
| Phase 3 (design system, pages) | **implemented**; no prototype review, no axe/Lighthouse pass yet |
| Phase 4 (feature depth) | quick-add parser, insights, CSV export done; the rest **not started** |
| Phase 5 (showcase) | landing, demo, security page, case study, headers, robots/sitemap done; `og:image`, canonical, `SECURITY.md`, E2E/Lighthouse gates, video **open** |
| Findings | all `SEC`/`DATA`/`BUG`/`DEBT` resolved or marked partial in [CURRENT-STATE §0.2](./CURRENT-STATE.md) |
| Owner decisions | applied at defaults; D7 (brand/agency credit) **open**; everything else awaiting confirmation |
| Not exercised in a real browser | legacy migration, backup restore via file picker, two-tab locking, Safari/Firefox |

Update this table when the state changes.
