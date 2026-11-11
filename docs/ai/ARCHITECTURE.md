# Architecture — how the system works today

> **Status:** describes the code as rebuilt on 2026-11-11 (uncommitted working tree on top of `8b21342`). The previous architecture (plaintext single-blob database, `AuthContext`, multi-user table) no longer exists; its audit is kept as history in [CURRENT-STATE.md](./CURRENT-STATE.md).
> **Scope:** the system **as built**. Where public copy and code disagree, the code wins and the copy is a bug. Re-check with `grep -n` if a file has moved.

## 1. What this is

A **client-only single-page app** for personal finance: entries, budgets, categories, charts. There is no backend and no API. Each **vault** is one **SQLite database compiled to WebAssembly (`sql.js`)**, encrypted as a whole with **AES-256-GCM** and stored as one string in **IndexedDB**. While a vault is unlocked, the decrypted database lives in the tab's memory only. There are no user accounts: a vault is a name, a password and a recovery key.

Default currency is BDT (any 2-decimal currency can be chosen). Deployed as static files (`vercel.json`: SPA rewrite, security headers, CSP). Public hostname used in `public/sitemap.xml`: `ledger.habibullah.dev` (live status not verified).

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| UI | React 18, TypeScript 5.8+ | app tsconfig non-strict; `tsconfig.strict.json` (strict) covers `crypto/ db/ lib/ vault/ config/` |
| Build | Vite 5 + `@vitejs/plugin-react-swc` | `pnpm build` does not typecheck; use `pnpm typecheck` / `pnpm check` |
| Routing | react-router-dom 6 | `BrowserRouter`, route-level `React.lazy` for everything that needs a vault |
| Database | sql.js 1.14 (SQLite WASM) | WASM file bundled by Vite, fetched on demand |
| Crypto | Web Crypto API only | AES-GCM, PBKDF2-SHA256, HKDF-SHA256. No crypto dependency |
| Persistence | localforage → IndexedDB | database `ledger-tracker`, store `vaults` |
| Validation | zod | parses backup/envelope JSON |
| Styling | Tailwind 3 + HSL CSS variables | "Banknote" design (glass panels, foil edge, colour pools, aurora), themes Pearl (light, id `paper`) / Vault (dark) |
| Components | shadcn/ui on Radix | 12 primitives kept in `src/components/ui/` |
| Charts | recharts | lazy chunk, loaded with the app Overview |
| Fonts | `@fontsource` (IBM Plex Sans, Sans Condensed, Mono; Noto Sans Bengali) | self-hosted |
| Tests | Vitest 3 (Node environment) | 119 tests; DOM-free (the logo tests render components to a string, no DOM) |

## 3. Runtime topology

```
 ┌──────────────────────────────── one browser tab ────────────────────────────────┐
 │ React pages / components                                                         │
 │   useVault()  useLedger()  useMutate()  useMoney()          (src/vault/*)        │
 │        │                       │ reads: synchronous, from the in-memory DB,      │
 │        │                       │ recomputed when snapshot.dataVersion changes    │
 │        ▼                       ▼                                                 │
 │   VaultService  ───────────►  sql.js Database (plaintext, memory only)           │
 │        │   save(): db.export() → AES-256-GCM(dek) → envelope JSON                │
 │        ▼                                                                         │
 │   localforage → IndexedDB  "ledger-tracker"/"vaults":                            │
 │        index            {v:1, vaults:[{id,name,createdAt}]}   (non-secret)       │
 │        vault:<id>        envelope JSON (ciphertext + wrapped keys)               │
 │                                                                                  │
 │   Web Lock "ledger-tracker:<id>" held while that vault is open                   │
 └──────────────────────────────────────────────────────────────────────────────────┘
   no server · no API · no third-party origins (CSP: connect-src 'self')
```

There is **no React Query cache and no session persistence**. Locking closes the database and does a full page navigation, which discards the JS heap and the WASM memory that held the plaintext.

## 4. Encryption design (`src/crypto/`)

**Key hierarchy (envelope encryption):**

```
 password ──NFKC──► PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte random salt ─► KEK_pw ─┐
 recovery key (160-bit random, Crockford base32) ─► HKDF-SHA256 ─────────────────► KEK_rk ─┤ wrap
                                                                                           ▼
                                      random 256-bit DEK  ◄── AES-GCM unwrap (one wrap per KEK)
 SQLite file ──AES-256-GCM(DEK, fresh 96-bit IV every save)──► ciphertext
```

- **Envelope** (`VaultEnvelope`, JSON, format `ledger-tracker-vault` v1): `vaultId`, `name` (unauthenticated label), `wraps[]` (`password` and `recovery`, each with KDF parameters, IV and the wrapped DEK), `data {iv, ct}`, `rev`, `updatedAt`. Binary fields are base64.
- **AAD** binds `vaultId`, the wrap type and the KDF parameters, so swapping or editing headers makes decryption fail.
- Nothing derived from the password is stored for checking it. A wrong password is just a failed AES-GCM authentication (`WrongCredentialsError`).
- The session DEK is a **non-extractable** `CryptoKey`. Changing the password re-wraps the DEK only (data is not re-encrypted). Rotating the recovery key replaces that wrap and disables the old key.
- Imported backups are capped at 10,000,000 PBKDF2 iterations (denial-of-service guard).
- **Recovery key format:** 32 Crockford base32 characters plus 4 check characters, shown as nine groups `XXXX-…`. Input is forgiving (case, dashes, O/0, I/L/1). The check characters catch typos; they add no security.
- **Password policy** (`checkPassword` in `vault/service.ts`): 10–256 characters, not one repeated character, and not rated weak by `estimateStrength` (`lib/password.ts`, a heuristic that prices a common word as one cheap guess).
- API surface: `createVaultEnvelope`, `unlockWithPassword`, `unlockWithRecoveryKey`, `sealEnvelope`, `changePassword`, `resetPasswordWithRecoveryKey`, `rotateRecoveryKey`, `serializeEnvelope`, `parseEnvelope`, `parseBackup`.

**What this does not defend against:** malware or hostile extensions on the device while unlocked, a compromised host serving altered code, weak passwords (PBKDF2 slows guessing but cannot save them), loss of both password and recovery key. Not independently audited.

## 5. Vault lifecycle (`src/vault/`)

- `service.ts` — `VaultService` (one per tab, from `runtime.ts`). Public API: `list`, `create`, `unlock`, `unlockWithRecovery`, `lock`, `openDemo`, `save`, `changePassword`, `rotateRecoveryKey`, `rename`, `exportBackup`, `importBackup`, `deleteVault`, `eraseAll`, `detectLegacy`, `migrateLegacyUser`, `deleteLegacy`, `inspect`, `settings`, `database()`, `getSnapshot`/`subscribe`.
- `VaultSnapshot` = `{ status: locked | unlocked, meta, ephemeral, dataVersion }`. `dataVersion` increments after each successful save.
- **Save:** serialised and coalesced. Every write path ends in `VaultService.save()`. `db.export()` in sql.js **resets PRAGMAs**, so `foreign_keys=ON` is re-applied after every export.
- **Single writer:** `navigator.locks.request("ledger-tracker:<id>", { ifAvailable: true })`; if another tab holds it, `VaultBusyError`.
- **Lock:** flush, `db.close()`, release the Web Lock, drop references, then `window.location.assign('/unlock')`. The reason (`manual` | `idle`) is passed through `sessionStorage` for a one-time message.
- **Auto-lock:** `VaultProvider` tracks activity with wall-clock time (so a suspended background tab still locks on return). Options 1, 5, 10, 15, 30, 60 minutes or never; default 5. `useAutoLockCountdown()` drives the header countdown.
- **Demo vault:** `openDemo(seed)` builds an in-memory database (`demo.ts`, six months of generated Dhaka-household entries, over a hundred of them); `ephemeral: true`, nothing is written.
- **Engine boot is on demand:** `VaultProvider` does not load `runtime.ts` (and so sql.js and its WASM) until a page calls `useStartVault()`. Marketing pages never trigger it.
- **Legacy migration** (`legacy.ts`): detects the old plaintext SQLite blob (header `SQLite format 3\0`) under the old localforage key `ledger_tracker.db`, lists its users, and imports **one user per new vault** into a fresh schema (never copying the plaintext password), then re-reads the new vault and verifies counts and sums before reporting success. The original is left untouched until `deleteLegacy()`.

## 6. Data layer (`src/db/`)

- **Schema v1** (`schema.ts`, applied by `migrate()` using `PRAGMA user_version`; refuses a newer version with `FutureSchemaError`):
  - `meta(key, value)` — vault settings such as currency.
  - `categories(id, name 1–60, icon, color hex, kind income|expense, archived, UNIQUE(kind,name))`
  - `transactions(id, kind, amount_minor > 0, category_id FK, note ≤ 500, occurred_on GLOB local date, created_at)`
  - `budgets(id, category_id FK, amount_minor > 0, period weekly|monthly|yearly, UNIQUE(category_id, period))`
  - No users table. Foreign keys are enforced.
- `sql.ts` — thin typed wrapper and `withTransaction`, which **nests** via `SAVEPOINT sp_N` so a repository function can run inside `useMutate` without a nested `BEGIN` failing.
- `repo.ts` — all reads and writes (typed rows, zod-checked where data comes from outside the app (`repo.ts` and `crypto/envelope.ts` use zod)), including `restoreTransactions` for undo. Rules: bound parameters only, no identifiers from input.
- **Money** (`lib/money.ts`): integer minor units; `parseMinor`, `formatMoney`, lakh/crore grouping for BDT (`en-IN`, `৳`), true minus sign. **Dates** (`lib/dates.ts`): local calendar-date strings `YYYY-MM-DD`, weeks start Saturday, `todayLocal`, `formatDateTime`. No `toISOString()` for "today".
- **Other helpers:** `stats.ts` (cash flow, category totals, budget progress), `insights.ts` (plain-language notes), `quickEntry.ts` (the one-line parser), `csv.ts`, `icons.ts`, `password.ts`.

## 7. UI layer

| Route | Component | Guard |
|---|---|---|
| `/` | `Landing` — hero and a real "seal a sample" demo (`components/landing/ProveIt.tsx`; the live network-request panel was removed on the owner's request, 2026-11-12) | public |
| `/security`, `/case-study` | `Security`, `CaseStudy` | public |
| `/create` | 3-step wizard: name and currency → password → recovery key with mandatory acknowledgement | public |
| `/unlock` | vault picker, password, recovery mode, restore from backup, typed-`ERASE` confirmation, backoff after failures | public |
| `/migrate`, `/demo` | legacy import; open demo vault | public |
| `/app`, `/app/entries`, `/app/budgets`, `/app/categories`, `/app/settings/:tab` (`appearance` \| `security` \| `data` \| `about`) | pages | `RequireVault` (renders `AppShell` + `<Outlet/>` only when unlocked, else redirects to `/unlock`) |
| `/landing`, `/about`, `/login`, `/ledger`, `/budgets`, `/settings` | `<Navigate>` redirects from the previous version | — |

- **Layouts:** `PublicLayout` (header, footer, skip link) and `AppShell` (floating glass dock ≥ md, floating bottom bar on phones, glass status pill with seal, vault name and lock countdown, `N` for a new entry, `EntrySheetProvider`). The dock is `components/layout/Sidebar.tsx`, mounted only from md up: nav links with live badges, a month card, a budget watch, a theme switch, Lock, and a collapsible icon rail. Its model is `sidebarModel.ts` (`NAV`, `useGoShortcuts` for `g` + letter, `useSidebarCollapsed`, `useSidebarSummary`); the numbers come from the pure, tested `src/lib/sidebarSummary.ts` using the same stats and budget progress as the Overview. `PublicLayout` is a floating glass pill header with a microprint footer. `Aurora` and `GlowTracker` are mounted once in `App.tsx`.
- **Data hooks:** `useLedger()` (synchronous snapshot of categories/transactions/budgets plus derived maps and `today`), `useMutate()` (runs a repository write in a transaction, saves, toasts), `useMoney()`, `useCurrencyInfo()`.
- **Theme:** `public/theme-init.js` runs before paint (blocking script, CSP-friendly) and sets `dark` and `data-theme`; `ThemeProvider` owns preference (`system | paper | vault`) and density.
- **Design tokens:** `src/index.css` (HSL variables for Pearl and Vault, `--foil-1..7`, `--glass-*`, `--chart-in/out`, `--aurora-o`, radius scale, row height; utilities `.glass`, `.well`, `.figure`, `.btn-primary`, `.btn-glass`, `.text-foil`, `.glow-text`, `.microprint`, `.outflow`; `@property --ang`; keyframes; print rules; reduced motion). Contrast was measured, not guessed (see [REDESIGN-AND-SHOWCASE.md](./REDESIGN-AND-SHOWCASE.md) §3.2).
- **Effects (`src/components/fx/`, `src/lib/`):** `Aurora` (fixed ambient background), `GlowTracker` (one delegated `pointermove` listener that sets `--mx/--my/--ang` on the hovered `.glass`; off for touch and reduced motion), `Glow` (soft foil-colour pool behind card content; strength from the `--glow-a*` tokens), `useCountUp` (used by `Money animate`), `Seal` (foil ring and keyhole, glow, pulse: the functional lock indicator). Brand: `components/brand/LogoMark.tsx` (`Logo`, the transparent mark used at every brand spot, and `LogoMark` with `tone` auto / on-light / on-dark; tokens `--logo-indigo`, `--logo-slate`, `--logo-ink`) drawing the generated `logoGeometry.ts`, which is the owner's own vector (`docs/brand/originals/`). The kit in `public/brand/`, `public/logo.svg`, `favicon.svg`, `favicon.ico` and `apple-touch-icon.png` is built from the same file by `docs/brand/build-logo-kit.py` and checked by `logo.test.ts` (REDESIGN §3.4, `docs/brand/README.md`). Landing-only: `components/landing/HeroCards.tsx` (tilting glass cards), `ProveIt.tsx`. No star/starburst ornaments (owner's rule, REDESIGN §3.1).
- **Bundle:** entry chunk ~420 kB (132 kB gzip); CSS ~12 kB gzip. Lazy chunks per page; `charts` (recharts) ~377 kB; `runtime` (sql.js glue); WASM 660 kB, fetched only when a vault page needs it.

## 8. Storage map

| Where | Key | Contents |
|---|---|---|
| IndexedDB `ledger-tracker`/`vaults` | `index` | non-secret list: id, name, createdAt |
| | `vault:<id>` | envelope JSON (ciphertext + wrapped keys + labels) |
| IndexedDB (legacy, default localforage instance) | `ledger_tracker.db` | the **old plaintext** database, if it exists; read by migration, removed only by `deleteLegacy()` |
| `localStorage` | `lt:theme`, `lt:density`, `lt:sidebar`, `lt:autolock`, `lt:last-vault` | preferences and the last-opened vault's random id (visible without the password anyway) |
| `sessionStorage` | `lt:lock-reason` | one-time reason for the last lock |

Visible without the password: vault name, id, created/updated times, revision count, ciphertext size, KDF parameters. Everything else is inside the ciphertext. Settings → Security shows the raw first bytes next to the SQLite header for comparison.

## 9. Network touchpoints

None at runtime. No fonts, scripts, avatars or analytics from other origins. `vercel.json` sends `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, plus `nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, COOP/CORP, `Permissions-Policy`, HSTS, immutable caching for `/assets/*`, and `X-Robots-Tag: noindex` for `/app`, `/unlock`, `/create`, `/migrate`, `/demo`. The Vite dev server sends none of these.

If analytics is ever added at the hosting level, the CSP will block it unless deliberately changed, and the Security page and README must be updated to say so.

## 10. Build, test, CI

- `pnpm dev` (`:8080`, bound to `localhost`), `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check`. `pnpm-workspace.yaml` `allowBuilds` lists `@swc/core` and `esbuild`.
- `vite.config.ts` injects `__APP_VERSION__` from `package.json` and holds the Vitest config (`environment: node`, `src/**/*.test.ts`).
- Tests: `crypto/envelope.test.ts` (20), `db/db.test.ts` (20), `vault/vault.test.ts` (21, including legacy import and locking with a fake lock provider), `lib/lib.test.ts` (14) and `lib/tools.test.ts` (12). No component or browser tests yet.
- `.github/workflows/ci.yml`: install (frozen lockfile), typecheck, lint, test, build. Not yet run on GitHub.

## 11. Gotchas

- `db.export()` resets PRAGMAs; always go through `VaultService.save()`.
- Never call `BEGIN` directly; use `withTransaction` (SAVEPOINT nesting).
- A full page load locks the vault by design. When testing in a browser, navigate with the router (or `history.pushState` + `popstate`) to stay unlocked.
- `.figure` sets `white-space: nowrap`; long multi-token strings need `whitespace-normal`.
- A flex or grid child holding a horizontally scrolling table needs `contain: layout` (or `min-w-0`) or it widens the page on phones.
- Vitest 5 does not support Vite 5; the project pins Vitest 3.2.7.
