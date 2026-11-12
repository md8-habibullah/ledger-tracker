# Ledger Tracker - project brief for Claude Code

Client-only React + TypeScript SPA: personal finance (entries, budgets, categories, charts) on **SQLite-WASM (`sql.js`)**. Each vault is one SQLite database **encrypted with AES-256-GCM** (password and recovery-key wrapped vault key) and stored in IndexedDB; the decrypted copy lives in tab memory only. No backend, no accounts. Vite + Tailwind + shadcn/ui. Default currency BDT. Design: "Banknote" (Pearl / Vault themes).

## Read first (in this order)
1. `docs/ai/ARCHITECTURE.md` - how it works today (trust it over README/page copy if they ever disagree).
2. `docs/ai/CURRENT-STATE.md` - §0 is the current baseline, resolved findings, known gaps and risks.
3. `docs/ai/ROADMAP.md` - §S says what is done / partial / open; owner decisions still to confirm.
4. `docs/ai/REDESIGN-AND-SHOWCASE.md` - design direction + page/feature plan (read before any UI or copy work).
5. `docs/ai/GUIDELINES.md` - rules, commands, recipes, gotchas.

## Commands (pnpm)
- `pnpm install --frozen-lockfile` · `pnpm dev` → http://localhost:8080 (no production CSP/headers there)
- `pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest, Node) · `pnpm build` (does **not** typecheck) · `pnpm check` runs all four
- strict-mode check for the core modules: `node_modules/.bin/tsc --noEmit -p tsconfig.strict.json`
- Run heavy commands one at a time (low-RAM machine). Baseline: tsc 0 errors, strict tsc clean, eslint 0/0, 173 tests pass, build OK.
- A page reload locks the vault by design; when testing in a browser, navigate inside the SPA or use `/demo`.

## Hard rules
- **Never `git commit` / `git push`** - leave changes for the owner (staging is fine).
- **Never make or restore a claim the code doesn't back** (encryption, passwords, offline, "zero network"). What is true today: the vault is encrypted at rest, no password is stored, locking drops the key and reloads the page, nothing leaves the device, and the limits (no audit, malware, altered host code, forgotten password plus lost recovery key, browser eviction) are stated on `/security` and in the README. Keep it that way.
- **Visual rules from the owner (never reverse):** (2026-11-11) no star, starburst or rosette ornaments anywhere. (2026-11-12, replaces the earlier multi-colour palette rule) **the whole product uses three colour families and no more: indigo (the logo's `#5a5da9`), slate (the logo's `#6d7987` and the cool neutrals) and one red (money out, over budget, errors).** Nothing green, yellow, orange, cyan or purple, in code, CSS or data defaults; the owner rejected the old emerald / lime / lemon / tangerine / coral / raspberry mix as unprofessional and not matching the logo. `src/theme/palette.test.ts` enforces it (hue families, no stray hex/`hsl()`/Tailwind palette colours, contrast); new UI takes colours from the tokens in `src/index.css` only. The owner's own logo (`LogoMark`) is the brand mark: it comes from the owner's vector files in `docs/brand/originals/`, so never redraw, recolour or restyle it (only the ink switches, see `docs/brand/README.md`). Colour-strength tokens (`--aurora-o`, `--glass-a1`, `--glow-a*`) are tuned to WCAG limits: re-run a contrast check when changing them. Details: `docs/ai/REDESIGN-AND-SHOWCASE.md` §3.
- **No new third-party requests** (fonts, CDNs, scripts, avatars, analytics). Self-host. The CSP in `vercel.json` enforces it.
- Data: SQL only in `src/db/` and `src/vault/`; bound parameters only; no identifiers from input; writes go through `useMutate` / `VaultService.save()` (it persists encrypted and re-enables foreign keys). Schema changes = a new migration step in `src/db/schema.ts` (ask the owner first). There is no `schema.sql`.
- Money is integer minor units; dates are local `YYYY-MM-DD` strings. Money/dates/currency only via the shared helpers in `src/lib` - no `USD`/`$` literals, no `toISOString().split('T')[0]` for "today".
- Never store, log or derive-and-store a password, key or recovery key. Crypto changes need tests first.
- Ask the owner before: schema changes, new dependencies, deleting files, changing public copy or positioning, relaxing the CSP, adding analytics, confirming a pending decision (ROADMAP §S).
- Update the affected `docs/ai/*` in the same change.
