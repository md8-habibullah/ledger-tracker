# Current state - audit, findings registry, baseline

> **Audited:** 2026-11-11 against commit `8b21342`. Evidence in §3–§4 is `file:line` **at that commit** and is kept as history: most of those files no longer exist.
> **Implemented:** 2026-11-11 (same day, uncommitted working tree). §0 is the current truth; read it first.
> How things were verified is listed in §7 - "RUN" means executed, "READ" means established by reading code.
> Finding IDs (`SEC-1`, `DATA-3`, …) are referenced by [ROADMAP.md](./ROADMAP.md). Severity: **Critical** (misrepresents security / can expose data), **High**, **Medium**, **Low**.

## 0. Current state (after the 2026-11-11 implementation)

### 0.1 Baseline now (RUN)

| Check | Command | At audit | Now |
|---|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit non-zero (`ERR_PNPM_IGNORED_BUILDS`) | exit 0 (`allowBuilds` in `pnpm-workspace.yaml`) |
| Typecheck | `pnpm typecheck` | 1 error | **0 errors** (app), and `tsconfig.strict.json` (strict) is clean for `crypto/ db/ lib/ vault/ config/` |
| Lint | `pnpm lint` | 11 errors, 10 warnings | **0 / 0** |
| Tests | `pnpm test` | none | **119 pass** (envelope crypto, database layer, vault service, helpers, legacy import, sidebar summary, logo fidelity) |
| Build | `pnpm build` | 1,157 kB JS (344 kB gzip), single chunk | entry chunk **420 kB (132 kB gzip)** after the visual redesign (was 381 kB / 120 kB), routes lazy-loaded, recharts (377 kB) only on the app Overview, SQLite WASM fetched only when a vault page needs it; no size warning |
| Runtime deps | `package.json` | 52 | **26** (31 unused packages removed; 4 self-hosted font packages added) |

Browser-verified on the production build served with the exact headers from `vercel.json` (enforced CSP): landing, seal demo, demo vault, create vault, entry via quick-entry line, lock, unlock, wrong password, recovery-key reset (old password rejected, new one works, data intact), 0 console errors, 0 CSP violations, 0 requests to other origins. Stored vault inspected in IndexedDB: no SQLite header, no category names or SQL text in the ciphertext, entropy 7.996 bits/byte, PBKDF2 600,000 iterations. Layout checked at 375 px for every route (no horizontal overflow).

**Visual redesign ("Banknote", 2026-11-11, uncommitted).** After the owner rejected the first look as flat, the whole interface was restyled (REDESIGN §3): glass panels with a pointer-reactive foil edge, aurora background, layered hero cards, floating dock/pill navigation, bento Overview, validated chart colours, Vault (dark) and Pearl (light) themes. **Second pass, same day, on the owner's feedback:** the starburst rosette (`Guilloche`, `src/lib/guilloche.ts` + its 6 tests, `VaultOrb`) was deleted and replaced by `Glow` and `HeroCards`; the purple/navy/cyan palette was replaced by an emerald/lime/lemon/tangerine/coral/raspberry mix on warm graphite and pearl; chart colours are now green in / raspberry out; new vaults get warm default category colours (existing vaults keep theirs); the owner's logo replaced the Seal as the brand mark and favicon. **Third pass, 2026-11-12, owner asked for a richer sidebar:** the desktop sidebar gained live nav badges (entries this month, budgets near or over their limit), a "this month" card (kept or overspent, in/out split, day of month), a budget watch (the three budgets closest to their limit), a Pearl/Vault/System switch, `g`-then-letter navigation shortcuts and a collapsible icon rail remembered on the device (`lt:sidebar`); phones get an alert dot on the Budgets tab and an icon-only New entry button. No schema, dependency or data-layer change (REDESIGN §3.5). **Fourth pass, 2026-11-12, owner supplied their real logo files:** the in-app mark, favicons and a new `public/brand/` kit now come from the owner's own vector (`docs/brand/`), replacing the earlier redraw (colours were `#5a5ca9`/`#6e7a88`, now the owner's exact `#5a5da9`/`#6d7987`); each theme is built from its own owner file (dark surfaces `lt02`, white edges; light surfaces `lt04`, black edges) and the ink switches per theme (`--logo-ink`); the logo is the transparent mark everywhere, never on a tile; `logo.test.ts` guards fidelity. The wordmark is **not** shipped: the supplied files hold it as live Satoshi text and it is white in all four (invisible on the light variants); an outlined version is needed from the designer. The live network-request panel was removed from the landing page on the owner's request (the seal-a-sample demo stays; four sentences that described the panel were reworded). Functionality, data layer and crypto were not touched. Verified: tsc 0 errors, strict tsc clean, eslint 0/0, 119 tests, production build; production build served with the `vercel.json` headers shows 0 console messages and 0 requests to other origins; 375 px sweep over `/app`, `/app/entries`, `/app/budgets`, `/app/categories` and the four Settings tabs shows no horizontal overflow; WCAG AA contrast measured by script for text pairs in both themes (glass over the centre of each aurora blob, in-card colour pools and the hero card; the script found and drove fixes for red and secondary text below 4.5:1 on a lime aurora peak); chart colours re-validated with the dataviz validator on the real glass surfaces; keyboard focus outline confirmed visible.

### 0.2 Resolution of the audit findings

| ID | Status | How |
|---|---|---|
| SEC-1 no encryption | **Fixed** | AES-256-GCM envelope encryption (`src/crypto/envelope.ts`); verified in the browser |
| SEC-2 plaintext passwords | **Fixed** | No password is stored anywhere; it only derives a key-wrapping key. Legacy plaintext passwords are never copied |
| SEC-3 session in localStorage | **Fixed** | No session persistence. Lock closes the DB and reloads the page. Auto-lock on inactivity (default 5 min) |
| SEC-4 unpinned third-party script | **Fixed** | Removed. The only script besides the bundle is the self-hosted `public/theme-init.js` |
| SEC-5 third-party requests, no CSP | **Fixed** | Fonts self-hosted (`@fontsource`), avatar removed, CSP and hardening headers in `vercel.json` |
| SEC-6 lock does not purge memory | **Fixed** | `db.close()` then full navigation; no query cache |
| SEC-7 register / reset / demo credentials on lock screen | **Fixed** | Erase needs a typed confirmation; the demo is a separate in-memory vault with no credentials |
| SEC-8 SQL identifiers from input | **Fixed** | Repository functions name their columns; values are bound parameters |
| DATA-1 dead `schema.sql` | **Fixed** | File deleted; the one schema is `src/db/schema.ts` with CHECK/UNIQUE/FK constraints |
| DATA-2 no migrations | **Fixed** | `PRAGMA user_version` migrations, refuses a newer schema (`FutureSchemaError`) |
| DATA-3 multi-tab overwrite | **Fixed** (unit-tested, not tried across two real tabs) | Per-vault Web Lock, `VaultBusyError` when held elsewhere; saves are serialised |
| DATA-4 destructive import | **Fixed** | Backup restore replaces the encrypted envelope atomically; legacy import verifies counts and sums before anything is deleted |
| DATA-5 `getDb` not single-flight | **Fixed** | One service promise per tab (`vault/runtime.ts`) |
| DATA-6 best-effort persistence | **Partly** | Encrypted backup download/restore and a "keep this data" request (`navigator.storage.persist`) exist; the browser can still evict storage. Stated in the UI and on the Security page |
| DATA-7 money as REAL | **Fixed** | Integer minor units (`amount_minor`) with `parseMinor`/`formatMoney` |
| DATA-8 UTC/local dates | **Fixed** | Local calendar-date strings via `src/lib/dates.ts` |
| DATA-9 FKs, category by name | **Fixed** | `foreign_keys=ON` (re-applied after every export), `category_id`, editable categories with merge and archive |
| BUG-1 theme on startup | **Fixed** | `public/theme-init.js` applies it before paint |
| BUG-2 mixed currencies | **Fixed** | All money goes through one helper |
| BUG-3 budget period ignored | **Fixed** | Weekly (Saturday start), monthly, yearly ranges; `UNIQUE(category_id, period)` |
| BUG-4 tsc fails | **Fixed** | 0 errors; `typecheck` script |
| BUG-5 row animation delay | **Fixed** | No per-row delay; "Show more" paging |
| BUG-6 destructive actions | **Fixed** | Undo toast for entry deletes, confirm dialogs for budgets and category merge/erase |
| BUG-7 copy bug | **Fixed** | Settings rewritten |
| BUG-8 chart axis | **Fixed** | Compact money formatter |
| BUG-9 accessibility | **Partly** | Focusable rows, labelled controls, measured contrast, chart data tables, announced errors. **No axe or Lighthouse run yet** |
| BUG-10 totals ignore month | **Fixed** | Labelled "All entries"; "No spending last month to compare" instead of 0.0% |
| DEBT-1 dead code | **Fixed** | Removed: old pages/components/hooks, 37 unused shadcn files (49 → 12 remain), `public/sql-wasm.wasm`, old screenshots, `scratch/`, 31 unused packages |
| DEBT-2 types | **Partly** | New modules compile under `strict`; the app tsconfig is still non-strict |
| DEBT-3 tests/CI | **Fixed locally** | 119 tests, `typecheck`/`check` scripts, `.github/workflows/ci.yml` (not yet run on GitHub) |
| DEBT-4 layering | **Fixed** | SQL only in `db/` and `vault/`; pages call repository functions through hooks |
| DEBT-5 two toast systems | **Fixed** | sonner only |
| DEBT-6 bundle | **Fixed** | See baseline |
| DEBT-7 branding artefacts | **Fixed** | Storage keys `lt:*`, package renamed, version injected from `package.json` |
| DEBT-8 tooling | **Fixed** | `allowBuilds`, `packageManager`, `engines`, dev server bound to `localhost` |
| DEBT-9 SEO | **Partly** | Honest title/description, theme-color, sitemap and robots correct, `noindex` on private routes. **Still missing:** `og:image`, canonical, manifest |
| DEBT-10 docs drift | **Fixed** | README and `docs/ai` rewritten |

### 0.3 Known gaps and risks now

1. **No independent security audit.** Said on the Security page and in the README. The crypto uses only Web Crypto primitives, with unit tests, but it is the owner's own implementation of the envelope scheme.
2. **A compromised host can serve altered code** (any web-delivered crypto has this). Mitigations: open source, CSP, self-hosting. The CSP allows `style-src 'unsafe-inline'` (libraries set style attributes at runtime); it forbids inline and remote scripts.
3. **Not exercised in a real browser:** legacy-data migration (covered by unit tests against a seeded legacy database), backup restore through the file picker, multi-tab locking, Lighthouse/axe, Safari and Firefox. Mobile layout was checked in Chrome device emulation only.
4. **Offline:** works only after the page has loaded; there is no service worker or manifest.
5. **Password strength** is a heuristic meter plus a hard refusal of anything it rates weak. Real protection is PBKDF2 cost plus password quality.
6. **Public positioning is unconfirmed** by the owner: brand name (D7), the case-study wording, and whether the agency credit in `src/config/site.ts` (`agency`, currently `null`) should be set.
7. **Visual effects are not profiled on weak hardware or other engines.** Backdrop blur, the animated aurora and the pointer-reactive edge were checked in desktop Chrome only (no Safari/Firefox, no low-end phone, no Lighthouse or axe run). The effects are transform-only, off for touch and reduced motion, and the aurora uses plain gradients, but real GPU cost is unmeasured. If a device struggles, `.glass` can drop `backdrop-filter` in one place in `src/index.css`.
8. ~~New public copy from the redesign awaits owner approval~~ **Approved by the owner 2026-11-11** (landing headings "Watch it prove itself.", "Check it yourself.", "Built for taka, built to stay out of the way.", the "Dark and light" tile, "See it with sample data.", and the theme name "Pearl"). Remaining visual note: the supplied logo is only 64 px, so the vector is a faithful redraw, not the original artwork (REDESIGN §3.4).

---

## 1. Executive summary (at audit - historic)

The app is a tidy, working local-first finance tracker with a clean enough structure to build on (hooks over a local SQL engine, shadcn components, sensible routes). Its **security story is the problem**: the README, Landing page and FAQ say the data is encrypted ("military-grade", "AES-256", "your password is never stored"), but **nothing is encrypted and passwords are stored in plaintext**. For a project that will be shown to clients as proof of quality, that gap is the single biggest risk - a technical visitor can open DevTools → Application → IndexedDB and see it in 30 seconds. Second: several visible bugs (mixed currencies on one screen, theme not applied on reload, budget periods ignored) that undermine polish. Third: no tests/CI, so none of it is protected from regressions.

Everything else (design, features, performance, SEO) is improvable, but those three items decide whether the showcase builds trust or loses it.

## 2. Baseline at audit (historic - current numbers are in §0.1)

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | installs OK; **exits non-zero** with `ERR_PNPM_IGNORED_BUILDS` (`@swc/core`, `esbuild`) under pnpm 12. Binaries ship as optional deps, so every tool below still works. Lockfile unchanged. |
| Typecheck | `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | **1 error** - `AuthContext.tsx:92` TS2367 (dead `'never'` comparison after narrowing). No `typecheck` script exists. |
| Lint | `node_modules/.bin/eslint .` | **11 errors, 10 warnings** - 7× `no-explicit-any` (5 in `sqlite-setup.ts`, 2 in `useTransactions.ts`), 1× `ban-ts-comment` (`sqlite-setup.ts:4`), 2× empty-interface (`ui/command.tsx:24`, `ui/textarea.tsx:5`), 1× `no-require-imports` (`tailwind.config.ts:153`); warnings are `react-refresh/only-export-components` + one `exhaustive-deps` (`useTheme.ts:204`). |
| Build | `node_modules/.bin/vite build` | succeeds in ~4.4 s. JS **1,157 kB / 344 kB gzip** (single chunk), CSS 75.7 kB, WASM 660 kB. Warnings: chunk > 500 kB; `db/index.ts` mixed static/dynamic import. |
| Dev server | `pnpm dev` | starts in ~160 ms on **`:8080`**, bound to `::` (LAN-reachable). `:5173` (README) does not respond. |
| Tests | - | **none exist** (no runner, no spec files, no CI, no `.github/`). |
| `scratch/test-sqlite.cjs` | `node scratch/test-sqlite.cjs` | passes, but it tests an inline mini-schema, not the app. |

## 3. Claims vs reality (at audit - all corrected; see §0.2)

| # | Claim (where) | Reality | Verdict |
|---|---|---|---|
| 1 | "Military-Grade Local Encryption" (`Landing.tsx:66`, footer `:302`); "Data is encrypted using your master password" (`:173`); "All encryption happens locally" (`:226`); README "AES-256 (Web Crypto)" | No crypto code at all; blob = plain SQLite | **False** |
| 2 | "Your password is never stored or transmitted… if you forget it, your data cannot be accessed" (`Landing.tsx` FAQ-2) | Password is stored in plaintext; data is readable without it | **False** |
| 3 | README "password hashing with bcrypt" / "bcrypt recommended" | No hashing | **False** |
| 4 | "Zero external network calls", "zero network connectivity" (README, Landing FAQ-1) | Google Fonts + jsDelivr script + GitHub avatar (ARCHITECTURE §10) | **False** |
| 5 | "The app works offline (including new data entry)" | Only after the page is loaded; no service worker/manifest | **Partly true** |
| 6 | "Vault is locked by default… clears session memory" | Locks at first load only; session restores from `localStorage.user_id`; in-memory DB and Query cache are not cleared on lock | **Misleading** |
| 7 | README: SQLite triggers recalc `spent_amount`; "no application-layer sync logic" | Triggers exist only in the unused `schema.sql`; runtime schema has no triggers/column; Budgets page computes spend in JS | **False** |
| 8 | README: "notifications when approaching or exceeding budget limits" | Colour/progress only (≥80 % amber, ≥100 % red); no notifications | **Overstated** |
| 9 | README: "Edit, delete, and export transactions with full audit trails" | No audit trail; export is Settings-only JSON | **Overstated** |
| 10 | README: "Nuke… DROP all tables… 10-second countdown" | Removes the IndexedDB key + `localStorage.clear()`; 10 s countdown is real | **True in effect** |
| 11 | README: dev server at `http://localhost:5173` | `:8080` | **Wrong** |
| 12 | README project tree: `VaultGateway` under `auth/` | It is in `components/vault/` | **Wrong** |
| 13 | README: multi-user "per-user sessions with persistent tokens" | A bare `user_id` integer in localStorage | **Misleading** |
| 14 | "Zero telemetry / no tracking" | True for the repo (no analytics code). If analytics is added at the hosting-domain level outside the repo, public copy must say so. | **True (repo)** |
| 15 | LICENSE vs history | `LICENSE` is MIT (a 2026-04-30 commit message mentions Apache 2.0 - stale) | OK, README matches LICENSE |

## 4. Findings registry (at audit - statuses in §0.2)

### 4.1 Security & honesty (`SEC`)

| ID | Sev | Finding | Evidence | Fix → |
|---|---|---|---|---|
| SEC-1 | **Critical** | No encryption at rest; marketing says otherwise | `sqlite-setup.ts:35-40` writes `db.export()` raw; grep for `crypto|subtle|bcrypt|pbkdf|argon` → 0 hits; claims in §3 | ROADMAP 0.1 (reword) → 2.* (implement) |
| SEC-2 | **Critical** | Passwords stored and compared in plaintext | `AuthContext.tsx:125` (`WHERE … password = ?`), `:140` (INSERT) | 2.* |
| SEC-3 | High | Session = `localStorage.user_id`, restored with no password; closing the tab leaves the vault unlocked indefinitely; setting `user_id` in the console unlocks; lock timer only lives in the open page; no lock on tab hidden/closed | `AuthContext.tsx:47-57`, `:76-121` | 2.4 |
| SEC-4 | High | Unpinned third-party script (`@main`) executes with full origin access (IndexedDB, localStorage, DOM) inside a financial app. **Audit of the content as fetched 2026-11-11:** 14,427 bytes, sha256 `36c89cebf8091a1f780f7e2d21dbf4215989fe314e8efee743aef7980b69abcf`; it defines a shadow-DOM "habibullah-launcher" widget listing 11 portfolio links, copies a URL to clipboard on click, `@import`s Google Fonts; **no fetch/XHR/storage access/eval** - benign today, but it is mutable (jsDelivr `@main` is a moving ref) so whoever controls that repo can ship code that reads the vault | `index.html:23-25` | 0.4 |
| SEC-5 | Medium | Other third-party requests leak IP/UA and break "zero network": Google Fonts `@import`, GitHub avatar. No CSP / security headers | `index.css:1`, `About.tsx:28`, `vercel.json` | 0.4, 2.8 |
| SEC-6 | Medium | `lockVault()` doesn't purge memory: `dbInstance` stays loaded; `QueryClient` cache is never cleared | `AuthContext.tsx:165-174`, `sqlite-setup.ts:7`, `App.tsx:18` | 2.4 |
| SEC-7 | Medium | Lock screen exposes unauthenticated **Register**, **Destructive Reset**, and `demo/demo` one-click credentials; "multi-user isolation" is only `WHERE user_id=?` over one shared unencrypted file | `Login.tsx:105-188` | 2.1 (D2), 3.9, 5.1 |
| SEC-8 | Low (latent) | SQL identifiers built from `Object.keys(updates)` without a whitelist | `useTransactions.ts:63-69`, `:122-128` | 1.4 |

### 4.2 Data integrity (`DATA`)

| ID | Sev | Finding | Evidence | Fix → |
|---|---|---|---|---|
| DATA-1 | High | `schema.sql` is dead; the runtime schema silently differs (no constraints/triggers/indexes/`spent_amount`; negative amounts, bogus types and duplicate budgets are accepted - RUN-verified) | `sqlite-setup.ts:47-85` vs `schema.sql` | 1.1 |
| DATA-2 | High | No schema version / migrations - any schema change breaks persisted DBs | `sqlite-setup.ts:19-26` | 1.1 |
| DATA-3 | High | Multi-tab last-writer-wins: each tab holds its own in-memory copy and overwrites the whole blob on every save; no `BroadcastChannel`/Web Locks | `saveDb()` `:35-40` | 1.5 |
| DATA-4 | High | Import is destructive and non-atomic: `DELETE` then per-row `INSERT` with no SQL transaction and no validation; a failing row leaves the in-memory DB half-replaced and the next `saveDb()` persists that state; categories/users not imported; `t.createdAt` may be undefined against `NOT NULL` | `Settings.tsx:110-148` | 1.3, 1.4 |
| DATA-5 | Medium | `getDb()` is not single-flight: concurrent first calls (session restore, categories query, `Index.initializeDatabase`) each instantiate WASM + a new `Database`; stale-instance writes are possible | `sqlite-setup.ts:9-33` | 1.2 |
| DATA-6 | Medium | Persistence is best-effort: no `navigator.storage.persist()`; browser eviction wipes everything; localStorage flags can outlive the DB, so the app silently restarts with an empty DB; backups are manual, plaintext, partial JSON | `grep storage.persist` → none | 4.1, 3.* |
| DATA-7 | Medium | Money stored as `REAL` (float); UI rounds to 0 decimals in `useCurrency` but shows 2 decimals in Ledger → the same amount renders differently | `sqlite-setup.ts:67`; `useCurrency.ts:59-60`; `Ledger.tsx:80` | 1.6 (D3) |
| DATA-8 | Low | Date handling mixes UTC and local: `new Date().toISOString().split('T')[0]` for "today" gives the **UTC date** (wrong between 00:00–06:00 in UTC+6); `new Date('YYYY-MM-DD')` parses as UTC but is compared with local month bounds (wrong bucket for UTC− users) | `QuickEntry.tsx:50`, `AddTransactionDialog.tsx:44,70`, `useTransactions.ts:155-161,199-206` | 1.7 |
| DATA-9 | Low | FKs not enforced (`PRAGMA foreign_keys`=0, RUN-verified), category linked by *name* (rename-fragile), categories global and not editable; icon names stored but never rendered | `sqlite-setup.ts:72`, `:110` | 1.1, 3.4 |

### 4.3 Functional / UX bugs (`BUG`)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| BUG-1 | High | **Saved theme is not applied on startup** - `useTheme` is mounted only in Settings, so reload → default dark until you open Settings | `Settings.tsx:77`; `useTheme.ts:202-204` |
| BUG-2 | High | **Mixed currencies on one screen**: Settings default is BDT, but Ledger, Budgets (also a literal `$`), RecentTransactions and CategoryChart hard-code USD (visible in `public/s-overview.png`: stat cards "BDT 929,300", donut legend "$22,000") | `Ledger.tsx:76`, `Budgets.tsx:39,164`, `RecentTransactions.tsx:23`, `CategoryChart.tsx:37` |
| BUG-3 | High | **Budget `period` is ignored**: progress is always the *current month's* category spend; weekly/yearly budgets are wrong; duplicate budgets for the same category/period are allowed | `Budgets.tsx:101-105`; runtime schema has no UNIQUE |
| BUG-4 | Medium | `tsc` fails (`AuthContext.tsx:92`) while `vite build` passes - typecheck is not part of any script | baseline |
| BUG-5 | Medium | Ledger renders every row with `delay: index*0.02` (1,000 rows ⇒ the last appears after 20 s); no pagination/virtualisation | `Ledger.tsx:281-286` |
| BUG-6 | Low | Destructive actions without confirm/undo: single transaction delete, budget delete | `Ledger.tsx:107-110`, `Budgets.tsx:92-99` |
| BUG-7 | Low | Copy bug: "Your vault will automatically lock after **auto-lock is disabled** of inactivity." | `Settings.tsx:283` |
| BUG-8 | Low | Spending-chart axis: `${symbol}${value/1000}k` ⇒ "৳0.5k" for small values | `SpendingChart.tsx:47` |
| BUG-9 | Low | Accessibility gaps seen in code (not a full audit): Ledger rows are click-only `div`s (not focusable); icon buttons in Budgets have no accessible name; Landing/Login hard-code palette so contrast isn't theme-checked; sonner follows OS theme (no `next-themes` provider) not the app theme | `Ledger.tsx:282-292`, `Budgets.tsx:259-274`, `ui/sonner.tsx:7` |
| BUG-10 | Low | Dashboard "Total Balance" and all-time totals ignore the selected month; `expenseChange` shows `↑ 0.0%` when last month is 0 (no "n/a") | `useTransactions.ts:163-190` |

### 4.4 Technical debt (`DEBT`)

| ID | Finding |
|---|---|
| DEBT-1 | **Dead code/assets:** `src/App.css`, `components/NavLink.tsx`, 31/49 shadcn primitives (alert, aspect-ratio, avatar, badge, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, radio-group, resizable, scroll-area, sidebar, skeleton, slider, switch, table, textarea, toggle-group, toggle, use-toast), deps `zod` + `@hookform/resolvers`, `Index.handleOpenAdd`, `unlockVault`, `public/sql-wasm.wasm` (duplicate, ~660 kB), `public/s-*.png` (unreferenced, stale, ~790 kB). *Unused primitives are tree-shaken from the bundle; delete for clarity, not size.* |
| DEBT-2 | **Types:** non-strict TS; `db: any`; `execQuery` returns untyped rows cast with `as Transaction[]` (no runtime validation); 7 explicit `any`. |
| DEBT-3 | **No tests, no CI, no typecheck script.** |
| DEBT-4 | **Layering:** pages (`Settings.tsx`, `Login.tsx`) and `AuthContext` run SQL directly; one `useTransactions` god-hook is instantiated by dialogs that only need categories. |
| DEBT-5 | **Two toast systems** mounted together (Radix + sonner). |
| DEBT-6 | **Bundle:** single 344 kB-gzip chunk; WASM and all routes load eagerly. |
| DEBT-7 | **Branding find-replace artefacts:** localStorage keys with spaces (`Ledger Tracker-theme`), export file name `Ledger Tracker-backup-….json`, `package.json` name `vite_react_shadcn_ts`, hard-coded `appVersion: '1.0.0'`. |
| DEBT-8 | **Tooling:** pnpm 12 `ERR_PNPM_IGNORED_BUILDS` (needs an `onlyBuiltDependencies` allowlist - decision for the owner, it edits project config); no `packageManager`/`engines`; `host: "::"` dev server exposed to LAN; browserslist data 11 months old. |
| DEBT-9 | **SEO/sharing:** no `og:image`, canonical, manifest, theme-color; sitemap lists gated routes and omits the public one; `/` is not public. |
| DEBT-10 | **Docs drift:** README contradicts the code (§3). |

## 5. What was already good (kept)

* Clear separation: components → hooks → one DB module; mutations always scope by `user_id` in the `WHERE` (good habit to keep).
* All SQL uses bound parameters (no string-built values anywhere except the identifier issue SEC-8).
* The nuke flow (type `DELETE`, then 10 s countdown) is a thoughtful, working destructive-action pattern.
* `sql.js` + IndexedDB is a legitimate, dependency-light local-first base; the whole DB is ~28 kB empty, so full-blob persistence is fine at this scale.
* shadcn/Radix gives accessible primitives (dialogs, selects, tabs) as a foundation.
* Build is fast (4 s) and the bundle is small enough to fix with routine splitting.

## 6. Open questions the code can't answer

1. Is `ledger.habibullah.dev` still the live deployment, and is any hosting-level analytics/CDN configured? (Affects how the privacy copy must be worded.)
2. Do real users already hold data in the plaintext format? (Decides how careful the encryption migration must be - see ROADMAP 2.6.)
3. Should the product keep multiple usernames in one vault, or become one-vault-per-person? (ROADMAP decision D2.)

## 7. Verification log

| What | How | Status |
|---|---|---|
| Typecheck / lint / build / dev server | commands in §2 | **RUN** |
| `schema.sql` valid; triggers sum all-time (ignore `period`); FK default off; runtime schema accepts junk and duplicates; `0.1+0.2` float artefact; empty DB export = 28,672 bytes | throw-away node script against project `sql.js` (SQLite 3.49.1) | **RUN** |
| `scratch/test-sqlite.cjs` | `node scratch/test-sqlite.cjs` | **RUN** (passes) |
| Third-party script content + hash | `curl` to a scratch file, read in full | **RUN / READ** |
| No crypto, no service worker/manifest, no multi-tab handling, no `storage.persist`, no network calls in app code | `grep -rniE` over `src index.html package.json vite.config.ts public` | **RUN** (grep) |
| Unused shadcn primitives / deps | scripted import scan | **RUN** |
| Auth, lock, import, budgets, currency, theme, date logic | full read of the files cited | **READ** (not exercised in a browser) |
| Current look & the USD/BDT mix | viewed `public/s-overview.png`, `s-ledger.png`, `s-settings.png` (these screenshots pre-date the vault work, so *wording* in them is stale; layout/visual language still matches the code) | **READ** |
| Not done | no browser E2E, no Lighthouse/axe run, no live-site check, no pen-test, no review of `ui/*` primitives beyond usage | - |
