# Guidelines - how to work in this repo (humans and AI agents)

> Updated 2026-11-11 after the vault/redesign implementation. These rules describe the code as it is now. The original audit-era rules (plaintext database, `AuthContext`, `getDb()`, `useTransactions`) no longer apply; if you meet them in an old note, the note is stale.

## 1. Read order

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - how it works (trust it over README and page copy).
2. [CURRENT-STATE.md](./CURRENT-STATE.md) - §0 is the current baseline, risks and what was resolved.
3. [ROADMAP.md](./ROADMAP.md) - §S says what is done, partial or open, and the next slice.
4. [REDESIGN-AND-SHOWCASE.md](./REDESIGN-AND-SHOWCASE.md) - design direction, page plans, showcase checklist (read before any UI or copy work).

## 2. Non-negotiable rules

1. **Never `git commit` / `git push`** (or open or merge PRs, or script them). Leave changes in the working tree; staging with `git add` is fine. Hand off to the owner.
2. **Truthfulness over polish.** Do not write, keep or restore any user-facing claim (README, Landing, Security page, FAQ, meta tags, docs) that the code does not back, especially about encryption, passwords, offline use and network activity. Re-read the code before editing such text. The Security page and README list the limits; keep them honest.
3. **No new third-party requests.** No CDN scripts, web fonts, images, avatars, analytics or iframes. Assets are self-hosted. Do not add tracking to the repo. The CSP (`vercel.json`) enforces this in production: `connect-src 'self'`, no remote scripts, fonts or images.
4. **Privacy scrub.** No personal data in code, docs, fixtures or screenshots: placeholders only (this repo may become public).
5. **Money, dates and currency go through the shared helpers** (§6). No `USD`/`$` literals, no `toISOString().split('T')[0]` for "today", no hand-built number formatting.
6. **Data access:** SQL lives only in `src/db/` and `src/vault/`. Bound parameters only; no identifiers from input; every write goes through `useMutate` (or `VaultService.save()`), which runs it in a transaction and then persists the encrypted vault.
7. **Docs are part of the change.** Update the relevant `docs/ai/*` in the same task (§9).
8. **Dependencies:** don't edit `pnpm-lock.yaml` by hand; don't add a dependency without a reason noted in the change and the owner's OK. The entry chunk is ~120 kB gzip; don't regress it.
9. **Ask the owner before:** schema changes, new dependencies, deleting files, changing public copy or positioning, relaxing the CSP, adding any analytics.
10. Run heavy commands **one at a time** (typecheck, lint, tests, build, dev server). This machine is memory-constrained.

## 3. Commands (verified 2026-11-11)

| Task | Command | Notes |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exits 0; `pnpm-workspace.yaml` `allowBuilds` lists `@swc/core` and `esbuild`. Don't approve other build scripts without the owner |
| Dev server | `pnpm dev` | **http://localhost:8080**, bound to `localhost`. Data is per-origin: other ports or hosts have separate vaults. The dev server does **not** send the production CSP/headers |
| Build | `pnpm build` | does **not** typecheck |
| Typecheck | `pnpm typecheck` | `tsc --noEmit -p tsconfig.app.json`; baseline 0 errors |
| Strict typecheck | `node_modules/.bin/tsc --noEmit -p tsconfig.strict.json` | strict mode over `crypto/ db/ lib/ vault/ config/`; keep it clean |
| Lint | `pnpm lint` | baseline 0 errors, 0 warnings |
| Tests | `pnpm test` (`pnpm test:watch`) | Vitest 3.2.7, Node environment, 119 tests |
| Everything | `pnpm check` | typecheck → lint → test → build |
| Preview build | `pnpm preview` | plain `vite preview`; for header-accurate testing serve `dist/` with the headers from `vercel.json` |

**Before handing work back** (sequentially): typecheck → strict typecheck → lint → tests → build → smoke test in a real browser against a production build with the CSP applied: create a vault, add an entry, reload (it must lock), unlock, wrong password, lock/unlock, switch theme, resize to 375 px and check for horizontal scroll, check the console and the network panel (same-origin only). Report what you ran and what you did **not** run.

**Browser testing gotcha:** a full page load locks the vault by design. Navigate inside the SPA (router links, or `history.pushState` + a `popstate` event) to stay unlocked, or use `/demo`.

## 4. Code conventions

* **Files:** components `PascalCase.tsx`; hooks and providers live beside their feature (`src/vault/useLedger.ts`, `VaultProvider.tsx`); pages default-export from `src/pages/` and are lazy-loaded in `src/App.tsx`; shadcn primitives in `src/components/ui/` (12 kept; add more only when needed).
* **Imports** use the `@/` alias for `src/`. Type-only imports as `import { type X }`.
* **Strict modules:** `src/crypto`, `src/db`, `src/lib`, `src/vault`, `src/config` compile under `strict`. New code in other folders should avoid `any` too.
* **Styling:** Tailwind utilities + `cn()`; colours from the CSS-variable tokens (`bg-background`, `text-muted-foreground`, `text-primary`, `bg-foil-2`, `outflow`), not raw hex. Surfaces are `.glass` panels (foil edge, blur) and `.well` insets; buttons are `.btn-primary` / `.btn-glass` via the `Button` variants. Chart marks use `--chart-in` / `--chart-out` only. Figures use the `.figure` class (mono, tabular, `nowrap`). `.text-foil` and `.glow-text` are for large decorative headings and figures, never small text.
* **Feedback:** `toast` from **sonner** only. Errors are shown with `describeError(error)`.
* **Motion:** transform/opacity only. Ambient drift (aurora), the hero cards' float and sheen, the hero rise, count-up figures, and responses to action are the allowed motion. No `filter: blur` on animated or per-item elements. Respect `prefers-reduced-motion` (CSS rule in `index.css`; JS effects check `matchMedia` themselves).
* **Errors:** expected failures are typed (`WrongCredentialsError`, `WeakPasswordError`, `VaultBusyError`, `FutureSchemaError`, …); map them to plain-language messages. Errors don't apologise and don't hint which of two credentials was wrong.
* No formatter is configured; match the file you are in.

## 5. Data rules

1. **Reads:** `const ledger = useLedger()` returns a synchronous snapshot (categories, transactions, budgets, derived maps, `today`) from the in-memory database; it is `null` while locked. It recomputes when `dataVersion` changes after a save.
2. **Writes:** `const mutate = useMutate(); await mutate((db) => repoFunction(db, …), { success: "…" })`. `useMutate` wraps the work in a transaction, saves (encrypts and stores), and toasts the outcome. Never call `db.run` from a component, and never `BEGIN`/`COMMIT` by hand; `withTransaction` nests with `SAVEPOINT`.
3. **Add a repository function** in `src/db/repo.ts` (typed rows, bound parameters, columns named in code) and a test in `src/db/db.test.ts`.
4. **Schema changes:** add a new migration step to `src/db/schema.ts` (bump `user_version`), keep earlier steps untouched, and test upgrading from the previous version. Ask the owner first. There is no `schema.sql`; the code is the schema.
5. **Money** is integer minor units (`amount_minor`). Parse with `parseMinor`, format with `formatMoney` / `useMoney()` / `<Money>`. Never do float arithmetic on amounts.
6. **Dates** are local calendar-date strings `YYYY-MM-DD`; compare them as text. Use `todayLocal()`, `formatDayLabel`, `formatDateTime` from `src/lib/dates.ts`. Weeks start Saturday.
7. **Persistence:** `db.export()` resets PRAGMAs, so always persist through `VaultService.save()`, which re-enables `foreign_keys`.
8. **Foreign keys are enforced.** Deleting a category in use is refused; offer merge or archive.
9. **Encryption changes** need tests first (`src/crypto/envelope.test.ts`): round-trip, wrong password, tampered ciphertext, tampered header, IV uniqueness. Never log keys, passwords or recovery keys. Never store a password or anything derived from it.
10. **Preferences** that are not secret go in `localStorage` under `lt:<name>` (existing: `lt:theme`, `lt:density`, `lt:sidebar`, `lt:autolock`, `lt:last-vault`). Anything about money stays inside the vault.

## 6. UI rules

1. Read REDESIGN §3 first. New UI uses the tokens and utilities (`.glass`, `.well`, `.btn-*`, `--foil-*`); do not add raw colours or fonts outside them. Glass over glass (dialogs, selects, tooltips) raises opacity with `[--glass-a1:0.94] [--glass-a2:0.92]`. Check any new text pair with a contrast script in both themes, including glass over the brightest aurora point.
2. Accessibility floor: every control keyboard-operable, visible focus, accessible names on icon buttons, no colour-only meaning (outflows carry "−"), reduced motion respected, contrast ≥ AA in **both** themes.
3. Empty, loading and error states are part of the component.
4. Copy: plain, active, sentence case; buttons say what happens ("Save entry", "Delete budget"). Destructive actions either offer Undo or ask for confirmation, with the destructive button styled `buttonVariants({ variant: "destructive" })`.
5. Responsive from 375 px up. Check for horizontal overflow on every route you touch. Tables inside flex/grid parents need `contain: layout` or `min-w-0`.
6. Never claim a security property in UI copy unless it is implemented and tested.
7. Password inputs sit in a form with a hidden username field (`UsernameHint`) so password managers behave; selects need a `name`.

## 7. Recipes

* **Use the logo:** `<Logo />` for brand spots (transparent mark, ink follows the theme; never put it on a tile), or `<LogoMark tone="on-light|on-dark|auto" />` on a surface you control. Never redraw or recolour it; rules in `docs/brand/README.md`. To rebuild the files from the owner's originals: `python3 -I docs/brand/build-logo-kit.py docs/brand/originals .`.
* **Add an app page:** create `src/pages/Foo.tsx` (default export), `lazy()`-import it in `src/App.tsx` and add `<Route path="foo" element={<Foo />} />` inside the `/app` `RequireVault` route; add `{ to: "/app/foo", label, icon, end, go }` to `NAV` in `src/components/layout/sidebarModel.ts` (`go` is the letter after `g` that jumps there; keep it unique). The desktop sidebar, the icon rail and the phone bar all render from `NAV`.
* **Add a public page:** same, but inside the `PublicLayout` route; add it to `public/sitemap.xml` if it should be indexed, and decide whether it needs `X-Robots-Tag: noindex` in `vercel.json`.
* **Add a currency:** append to `CURRENCIES` in `src/lib/money.ts` (code, symbol, exponent, locale) and add a test.
* **Add a setting that lives in the vault:** store it in the `meta` table through a repository function. A UI-only preference goes in `localStorage` as `lt:<name>`; if it must be known before first paint, extend `public/theme-init.js`.
* **Add a shadcn component:** `pnpm dlx shadcn@latest add <name>`, then review the diff and remove anything unused. This adds a dependency, so ask first.
* **Reset local dev data:** DevTools → Application → Clear site data for `localhost:8080`, or use the erase flow on `/unlock`.
* **Test a legacy migration by hand:** seed a plaintext database under the default localforage key `ledger_tracker.db` (a `SQLite format 3` file) and open `/migrate`. The unit tests in `src/vault/vault.test.ts` show how to build one.

## 8. Gotchas

1. A page reload locks the vault (no session persistence). That is a feature; tests must navigate within the SPA.
2. `db.export()` resets PRAGMAs (see §5.7).
3. The dev server must be restarted after editing `tailwind.config.ts` (new classes such as `bg-foil-1` otherwise compute to transparent). `.figure` sets `white-space: nowrap`; strings containing many tokens (hex dumps, long dates) need `whitespace-normal`.
4. Radix `<Select>` renders a hidden native `<select>`; give it `name` or the browser reports a form-field issue.
5. `style-src 'unsafe-inline'` is on in the CSP because Radix and recharts set inline styles at runtime. The only script besides the bundle is the self-hosted `public/theme-init.js`; `script-src 'self'` forbids inline scripts, so don't add any.
6. Vitest 5 requires a newer Vite than this project uses; Vitest is pinned at 3.2.7.
7. `Permissions-Policy` rejects unknown feature names with a console warning (a removed `bluetooth` entry caused one); check the console after editing headers.
8. Analytics injected at the domain level (for example a hosting-provider snippet) is blocked by the CSP. If the owner wants it, they must decide to relax the CSP and update the Security page and README in the same change.
9. The password-strength meter is a heuristic and advisory. Real protection is the KDF cost plus password quality; the service also refuses anything the meter rates weak.
10. Browser storage can be evicted. The UI offers backup download and a "keep this data" request (`navigator.storage.persist`), and says plainly that neither is a guarantee.

## 9. Keeping docs current (same change, every time)

| You changed… | Update |
|---|---|
| routes, providers, lock flow, storage keys | ARCHITECTURE §5, §7, §8 |
| schema, repositories, persistence, crypto | ARCHITECTURE §4, §6; CURRENT-STATE §0 |
| fixed or discovered a bug or risk | CURRENT-STATE §0.2 / §0.3, ROADMAP §S |
| design tokens, components, page layouts, copy voice | REDESIGN §3–§5 |
| scripts, tooling, baseline numbers | this file §3, CURRENT-STATE §0.1, ARCHITECTURE §10 |
| completed or started a roadmap item | ROADMAP §S status table (add the commit hash **after the owner commits**) |
| any public claim (README, Landing, Security, FAQ, meta) | re-verify against the code; ARCHITECTURE if the facts changed |
| CSP or headers | `vercel.json`, ARCHITECTURE §9, the Security page |

Keep history that explains why a rule exists; mark things fixed, don't delete them.

## 10. Testing guidance

* Unit tests (Vitest, **Node environment**) cover crypto, database, vault service and helpers. Crypto uses Node's global WebCrypto; DB tests use in-memory `sql.js`. Fake the Web Locks API where a test needs two tabs (see `vault.test.ts`).
* Not covered yet: components, routing, real browsers, two-tab behaviour, accessibility tooling. ROADMAP 5.6 plans Playwright E2E (create → add → lock → unlock → export → restore → erase), axe and Lighthouse.
* When you add behaviour, add a test beside it. When you fix a bug, add the test that would have caught it.
