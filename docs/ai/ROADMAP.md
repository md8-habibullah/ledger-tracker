# Roadmap — what to change, in what order

> Derived from [CURRENT-STATE.md](./CURRENT-STATE.md) (findings `SEC/DATA/BUG/DEBT-*`) and [REDESIGN-AND-SHOWCASE.md](./REDESIGN-AND-SHOWCASE.md) (design, features `F-*`). **Phases 0–3 and the core of 5 were implemented on 2026-11-11; the table in §S says item by item what is done, partial or open.** Sections 0–4 below are the original plan, kept so the reasoning and acceptance criteria stay visible. Sizes **S / M / L / XL** are relative effort. Item IDs (`0.1`, `2.4`, …) are referenced from the other docs — keep them stable.

## S. Status after the 2026-11-11 implementation

The owner asked for everything to be implemented ("go ahead and do implement all of this"). Decisions that were still pending were **taken at the recommended default**, so they are provisional until the owner confirms them:

| Decision | Applied | Confirmed by owner? |
|---|---|---|
| P path | **B** — data layer and real encryption first, then redesign | blanket approval |
| D1 reword false claims | done (every row of CURRENT-STATE §3 corrected) | blanket approval |
| D2 vault model | one vault per password, picker on the lock screen | blanket approval |
| D3 integer minor units | done | blanket approval |
| D4 KDF | **PBKDF2-SHA256, 600,000 iterations** (WebCrypto, no dependency); algorithm and parameters are stored in the envelope so Argon2id can be added later | blanket approval |
| D5 third-party launcher | removed from the app | blanket approval |
| D6 design direction | **Superseded 2026-11-11 by "Banknote"** (owner asked for a bolder, next-generation look; Pearl + Vault themes). **Copy and the "Pearl" name approved by the owner the same day.** Owner rules since: no star/starburst ornaments, no purple/navy/cyan palette; the owner's own logo is the brand mark (REDESIGN §3.1, §3.4). Was: Green-bar Ledger, Paper + Vault themes, `/` + `/app/*` split; old themes and the donut chart dropped | blanket approval — **no prototype review happened** |
| D7 brand | kept "Ledger Tracker"; `SITE.agency` (`src/config/site.ts`) is `null`, so no agency credit is shown | **open** |
| D8 recovery key | mandatory acknowledgement (save it, or explicitly skip) | blanket approval |
| pnpm allowlist | `allowBuilds` in `pnpm-workspace.yaml` | blanket approval |

**Legend:** ✅ done · 🟡 partly done · ⬜ not started.

| Item | State | Notes |
|---|---|---|
| 0.1 honest copy | ✅ | landing, FAQ, README, Security page |
| 0.2 green baseline | ✅ | tsc 0, eslint 0/0, `typecheck` script |
| 0.3 delete dead code | ✅ | 37 shadcn files, 31 packages, old pages, `schema.sql`, wasm copy, screenshots, `scratch/` |
| 0.4 network hygiene | ✅ | fonts self-hosted, launcher and avatar removed; the CSP went straight to **enforced** |
| 0.5 tests + CI | 🟡 | 114 Vitest tests (Node, no DOM); `ci.yml` written but never run on GitHub; no component tests |
| 0.6 tooling | ✅ | `packageManager`, `engines`, `allowBuilds`, dev host `localhost` |
| 0.7 quick fixes | ✅ | |
| 1.1 schema + migrations | ✅ | `PRAGMA user_version`; FKs on; legacy upgrade through `migrateLegacyUser` |
| 1.2 single-flight + save queue | ✅ | |
| 1.3 transactions | ✅ | `withTransaction` with SAVEPOINT nesting |
| 1.4 repository layer + validation | ✅ | zod at the file boundary (envelope/backup, repo rows) |
| 1.5 multi-tab safety | 🟡 | per-vault Web Lock + `VaultBusyError`. No `BroadcastChannel`; not tried across two real tabs |
| 1.6 integer minor units | ✅ | |
| 1.7 local dates | 🟡 | helpers and tests exist; test run under `TZ=Asia/Dhaka` / `America/Los_Angeles` not automated |
| 2.1 model + threat model | ✅ | ARCHITECTURE §4, Security page |
| 2.2 crypto module + tests | ✅ | tamper, wrong-password, header-AAD, IV-uniqueness tests |
| 2.3 flows on the encrypted store | ✅ | |
| 2.4 lock semantics | 🟡 | idle auto-lock (wall-clock), manual lock, page reload locks. **No "lock when tab hidden > N min"** (a hidden tab locks on return if the timer elapsed) |
| 2.5 recovery key + backup/restore | 🟡 | recovery key and encrypted backup done; restore through the file picker **not browser-tested**; backup is the envelope JSON, not a `.ledgerbak` extension |
| 2.6 legacy migration | 🟡 | unit-tested against a seeded legacy DB; **not run in a browser** |
| 2.7 change password / rotate recovery key | ✅ | |
| 2.8 enforced CSP + headers | ✅ | `vercel.json`; verified on a production build served with those headers |
| 2.9 WebAuthn PRF | ⬜ | |
| 3.1 tokens, fonts, themes | ✅ | |
| 3.2 AppShell + routes | 🟡 | done; **no command palette** (`cmdk` removed); `N` opens a new entry; `g` then `o`/`e`/`b`/`c`/`s` jumps to a page; sidebar with live badges, month snapshot, budget watch, theme switch and a collapsible icon rail (REDESIGN §3.5); **no `?` shortcut sheet** |
| 3.3 currency provider | 🟡 | one set of helpers + `<Money>`; no lint rule banning `Intl.NumberFormat`; no Bangla digits yet |
| 3.4 categories manager | ✅ | add, rename, recolour, archive, merge |
| 3.5 Overview | ✅ | |
| 3.6 Entries | 🟡 | filters, undo, banded rows, multi-select with bulk delete, keyboard; paged (scroll sentinel + "Show more"), **not virtualised**; no saved views; CSV export of the filtered view on Entries and of all entries under Settings → Data |
| 3.7 Budgets v2 | 🟡 | periods, projection, thresholds; no rollover |
| 3.8 Settings | 🟡 | four tabs (appearance, security, data, about); no separate Region tab |
| 3.9 Create & Unlock + Seal | ✅ | backoff after failed attempts; erase flow kept |
| 3.10 accessibility pass | 🟡 | manual measures only; **no axe / Lighthouse run, no screen-reader or full keyboard pass** |
| 3.11 i18n EN + বাংলা | ⬜ | the Bengali font is bundled; strings are English only |
| 4.1 PWA | ⬜ | |
| 4.2–4.4 accounts, recurring, reports | ⬜ | |
| 4.5 CSV import + exports | 🟡 | CSV **export** done; import wizard not started |
| 4.6 quick-add parser | ✅ | |
| 4.7 insights | ✅ | `lib/insights.ts`, shown on Overview |
| 4.8–4.12 goals, dena-paona, attachments, undo/redo, extras | ⬜ | entry-delete undo exists as a toast only |
| 5.1 landing, demo, prove-it | ✅ | 0 third-party requests on the landing page (measured); the CSP blocks any on the other routes. The live network-request panel was removed on the owner's request (2026-11-12); the seal-a-sample demo stays |
| 5.2 `/security` | ✅ | |
| 5.3 `/case-study` | 🟡 | written (decisions, stack, diagram); it contains **no measured figures**, so the "CI-generated numbers" criterion is not met |
| 5.4 SEO & sharing | 🟡 | title, description, `og:*`/`twitter:*` text, `theme-color`, sitemap, robots, `noindex` on private routes. **Missing:** `og:image`/`twitter:image`, canonical, JSON-LD, prerendering (it is a client-rendered SPA) |
| 5.5 repo polish | 🟡 | README rewritten. **No** `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue templates, social preview |
| 5.6 CI quality gates | ⬜ | no Playwright, axe, Lighthouse CI or bundle budget |
| 5.7 demo video + screenshots | ⬜ | |
| 5.8 launch checklist | ⬜ | see REDESIGN §7 Z |

**Suggested next slice:** (1) run the browser-only checks that were skipped: legacy migration, backup restore, two-tab locking, axe/Lighthouse, Firefox and Safari; (2) `og:image`, canonical, `SECURITY.md`; (3) Playwright E2E for create → add → lock → unlock → export → restore; (4) then pick from Phase 4 (CSV import, PWA, Bangla).

## 0. Decisions the owner must make (original table — see §S for what was applied)

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| **P** | **Which path?** (A) *Honest MVP* — fastest thing you can show clients: truthful copy, new design on Overview/Entries, public landing + demo, encryption labelled "in progress". (B) *Recommended* — fix data layer + real encryption **before** the public showcase, then redesign + features. | **B**. Path A is honest but its security page has to say "not encrypted yet", which weakens the pitch; the encryption work is itself the strongest proof of engineering quality. A is a fine stepping stone if a client meeting is imminent. | sequencing |
| D1 | Reword the false security claims now (Landing, FAQ, README) instead of waiting for Phase 2? | **Yes** — they are false today and the site appears to be public. One small change (0.1). | 0.1 |
| D2 | Vault model: keep multiple usernames inside one shared file, or **one vault = one master password** (optionally several vaults with a picker)? | One vault per password (+ picker). It is the only model where encryption is meaningful; drops `users.password` entirely. | 1.1, 2.1–2.3, 2.6 |
| D3 | Money as **integer minor units** (paisa/cents) instead of `REAL`? | **Yes**, and do it in Phase 1 so the plaintext→encrypted migration (2.6) runs once over the final schema. | 1.6 |
| D4 | KDF: **Argon2id** (small audited WASM lib, stronger vs GPUs) or **PBKDF2-SHA256** (WebCrypto, zero deps, ≥ 600 k iterations)? | Argon2id if the bundle/CSP cost is acceptable; else PBKDF2. Store algorithm + parameters in the envelope so it can change later. | 2.2 |
| D5 | Third-party `launcher.js` (agency widget) in `index.html`? | Remove from the app; keep it on the agency site only. | 0.4 |
| D6 | **Superseded:** the owner replaced Green-bar Ledger with the bolder **Banknote** direction (Pearl + Vault themes; see REDESIGN §3). Still to confirm: the new public copy and the "Pearl" theme name. Original question: approve the **Green-bar Ledger** direction (Paper + Vault themes only; drop ocean/forest/sunset), the **`/` landing + `/app/*`** route split, and replacing the donut chart? | Approve after seeing a Paper/Vault prototype of Overview + Entries + Lock. | 3.1, 3.2, 5.1 |
| D7 | Product name/brand: keep "Ledger Tracker" or rebrand (check trademark/store collisions)? | Decide before the OG image, logo and README are produced. | 5.4, 5.5, 5.7 |
| D8 | Recovery key at vault creation: mandatory step, or skippable with explicit consequence text? | Mandatory *acknowledge* (can skip, but must confirm "no recovery"). | 2.5 |
| — | pnpm 12 build-script allowlist (`onlyBuiltDependencies` for `esbuild`, `@swc/core`) edits project config. | Approve in 0.6. | 0.6 |

## 1. Paths at a glance

```
Path B (recommended)
 Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 5 (public) ─► Phase 4 (depth, any order)
 truth      data       real       design +   landing/demo/        features
 +safety    layer      encryption  pages     proof/SEO/CI         (pick à la carte)
  net                                 ▲
        3.1 tokens + 3.3 currency can start alongside Phase 1 (different layers)

Path A (fast honest MVP)
 0.1–0.7 ─► 3.1 ─► 3.3 ─► 3.5 Overview ─► 3.6 Entries ─► 5.1 landing+demo (no encryption claims) ─► 5.4 ─► 5.5
 then continue with Phase 1 → 2 and upgrade the claims when 2.* ships
```

**Slice discipline:** work one vertical slice at a time; every slice ends with typecheck + lint + tests + build green, the affected `docs/ai/*` updated in the same change, and the claims reviewed.

## Phase 0 — Truth, hygiene, safety net

| ID | Item | Size | Findings | Accept |
|---|---|---|---|---|
| 0.1 | **Interim honest copy.** Landing hero/FAQ/footer, README (encryption, bcrypt, triggers, zero-network, ports, tree) reworded to what is true: "local-only, stored in your browser, **not yet encrypted**". Remove "military-grade". | S | SEC-1/2, DEBT-10 | every sentence in CURRENT-STATE §3 resolved; D1 |
| 0.2 | **Green baseline.** Fix `AuthContext.tsx:92`; fix the 11 lint errors (type `db`, whitelist update fields, `ts-expect-error`, empty-interface, tailwind `import` plugin); add `"typecheck": "tsc --noEmit -p tsconfig.app.json"` script. | S | BUG-4, DEBT-2 | `pnpm typecheck && pnpm lint && pnpm build` all exit 0 |
| 0.3 | **Delete dead code/assets:** `App.css`, `NavLink.tsx`, 31 unused shadcn files, `public/sql-wasm.wasm`, deps that become unreferenced (`@hookform/resolvers`, `react-hook-form` stay only if the new forms adopt them — decide in 1.4; **keep `zod`**, 1.4 uses it), `Index.handleOpenAdd`, redundant `initializeDatabase()` effect, one toast system (keep sonner), `unlockVault` if still unused, stale `public/s-*.png` (confirm nothing external hot-links them). | S | DEBT-1, DEBT-5 | build output smaller; no references broken |
| 0.4 | **Network hygiene (D5).** Remove the launcher `<script>`; self-host Outfit/JetBrains (interim) or the final Plex/Noto via `@fontsource`; remove the GitHub avatar fetch; add a **report-only** CSP via `vercel.json` headers to discover violations. | S–M | SEC-4/5 | DevTools Network shows only same-origin requests; CSP report-only clean |
| 0.5 | **Test harness + CI.** Vitest (+ jsdom/Testing Library); extract pure `computeStats()` from `useTransactions`; first tests for stats, date, currency formatting. GitHub Actions workflow: install (frozen) → typecheck → lint → test → build. *(The owner commits/pushes; agents only write the file.)* | M | DEBT-3 | CI green; ≥ 15 meaningful tests |
| 0.6 | **Tooling.** `packageManager` + `engines`; pnpm build-script allowlist (needs approval); dev server host defaults to `localhost` (LAN opt-in); refresh browserslist. | S | DEBT-8 | `pnpm install` exits 0 |
| 0.7 | **Quick bug fixes** that are cheap now and subsumed later: apply saved theme at root (BUG-1), single currency source + `Money` formatting in Ledger/Budgets/Recent/Category (BUG-2), copy bug (BUG-7), axis ticks (BUG-8), local-date helpers (DATA-8 → completes in 1.7). | M | BUG-1/2/7/8 | no `USD`/`$` literals outside currency data; reload keeps theme |

## Phase 1 — Data foundation (prerequisite for encryption, accounts, reports)

| ID | Item | Size | Findings | Accept |
|---|---|---|---|---|
| 1.1 | **Schema as code + migrations.** One source of truth (`src/db/schema/…` ordered migrations keyed by `PRAGMA user_version`); `PRAGMA foreign_keys=ON` on every open; CHECKs, UNIQUE(user/vault, category, period), indexes; categories referenced by **id**; drop `spent_amount`/triggers (derive spend per period at read time); delete or generate `schema.sql` from the migrations so it can't drift. Migration of existing (legacy) DBs included. | L | DATA-1/2/9, BUG-3 | opening a v0 DB upgrades it in place; invalid rows rejected (tested); weekly budget ignores old spending |
| 1.2 | **Single-flight `getDb()`** + **serialised, debounced save queue**; surface IndexedDB/quota errors to the UI. | M | DATA-5 | one WASM init per page load (tested); no lost writes under rapid mutations |
| 1.3 | **`withTransaction(db, fn)`** (BEGIN/COMMIT/ROLLBACK) and use it for import, clear, multi-row mutations. | S | DATA-4 | injected failure mid-import leaves data unchanged |
| 1.4 | **Repository layer** (`src/db/repos/*`), typed row mappers (no `any`), **field whitelists** for updates, **zod** validation at every boundary (forms, import file). Pages/AuthContext stop calling SQL. | L | DEBT-2/4, SEC-8, DATA-4 | `grep getDb src/pages` → none; invalid import rejected with a readable error |
| 1.5 | **Multi-tab safety:** Web Locks API for writers + `BroadcastChannel` change notices + a version counter in the stored envelope; stale tab becomes read-only or reloads. | M | DATA-3 | two-tab E2E: neither tab loses writes |
| 1.6 | **Money as integer minor units** (D3) with per-currency exponent; migration from `REAL`. | M | DATA-7 | `0.1 + 0.2` style sums exact; displays match entry |
| 1.7 | **Local-date helpers** (`todayLocal()`, `parseLocalDate()`, month bounds) replacing `toISOString().split('T')`/`new Date('YYYY-MM-DD')`. | S | DATA-8 | tests pass under `TZ=Asia/Dhaka` and `TZ=America/Los_Angeles` |

## Phase 2 — Real vault security (feature F-1)

### 2.0 Design notes (so the implementer starts from a vetted shape)

* **Envelope encryption (recommended).** A random 256-bit **vault key (DEK)** encrypts the database. The DEK is *wrapped* (AES-GCM or AES-KW) separately by: (a) a **KEK derived from the master password** with the chosen KDF + random 16-byte salt; (b) a **recovery key** (random, shown once as grouped Base32 or words); (c) optionally a WebAuthn-PRF secret. Changing the password or recovery key = re-wrap the DEK; the database is not re-encrypted.
* **Stored object** (IndexedDB, new key per vault, e.g. `vault:<id>`): `{ v, kdf:{alg, params, salt}, wraps:[{type, iv, ct}], data:{iv, ct} }`. Use a **fresh random 96-bit IV for every encryption**, authenticate the header as **AAD** (prevents KDF-parameter downgrade), AES-256-GCM tag = integrity. Wrong password ⇒ unwrap fails ⇒ one generic error (no username/password oracle).
* **KDF parameters:** follow the current OWASP Password Storage Cheat Sheet *at implementation time* (as of the 2023 revision: PBKDF2-HMAC-SHA256 ≥ 600,000 iterations; Argon2id ≥ 19 MiB memory, 2 iterations, 1 lane — verify before coding). Offline brute-force of a stolen blob is the real attack; KDF cost + password strength are the defence. Measure unlock time on a low-end phone and keep it ≈ 0.5–1 s.
* **Keys in memory only.** After unwrap, hold the DEK as a **non-extractable `CryptoKey`**. sql.js still needs the plaintext database bytes in the WASM heap while unlocked — unavoidable. JS cannot securely zero memory, so **lock = `db.close()`, drop all references, clear the Query cache, and reload the page** (a hard reset releases the WASM heap).
* **No session persistence.** Delete `localStorage.user_id` semantics entirely; "remember me" is not offered. Tab close = locked by construction.
* **Save path:** debounced `db.export()` → AES-GCM → write envelope (atomic: write new value, then update pointer/version).
* **Migration of legacy vaults (2.6):** detect plaintext by the 16-byte header `"SQLite format 3\0"`; require a **backup download first**; verify the user's legacy credentials; choose the master password; build the envelope; write to the new key; **decrypt round-trip verify**; only then delete `ledger_tracker.db` and scrub `users.password`. If the legacy file has several users, each becomes its own vault (each must set a password) — D2.
* **Honest limits (publish them):** an XSS bug or malicious browser extension can read data while unlocked; a weak password is brute-forceable offline; device compromise defeats everything; the *existence and rough size* of the vault is visible; no recovery without the recovery key.
* **Tests (must exist before shipping):** round-trip; wrong password; tampered ciphertext (flip one bit) fails; tampered header/AAD fails; IV uniqueness across saves; KDF param change handled; migration idempotent and interruptible.

| ID | Item | Size | Findings | Accept |
|---|---|---|---|---|
| 2.1 | Vault model + key hierarchy + threat model written (D2, D4); update ARCHITECTURE §13. | S | SEC-7 | doc merged, owner-approved |
| 2.2 | `src/crypto/` module (KDF, envelope, wrap/unwrap, encode/decode) **with the tests above**. No dependency on React. | L | SEC-1/2 | tests green incl. tamper cases |
| 2.3 | Create/unlock flows operate on the encrypted store; remove `users.password` and plaintext compare; `getDb()` loads via envelope. | L | SEC-1/2 | DevTools shows only ciphertext; no password stored anywhere |
| 2.4 | **Lock semantics:** key memory-only; remove `user_id` session restore; lock on idle, **on tab hidden > N min**, and on close; lock = close DB + clear Query cache + reload; visible countdown. | M | SEC-3/6 | reopen tab ⇒ locked; E2E proves no session survives |
| 2.5 | Recovery key (D8) + **encrypted backup/restore** (`.ledgerbak`) + plaintext JSON/CSV export behind a warning. | M | DATA-6 | restore on a fresh profile works (E2E) |
| 2.6 | **Legacy plaintext → encrypted migration** (see 2.0). | L | SEC-1 | interrupted migration never loses data; old blob removed only after verify |
| 2.7 | Change password / rotate recovery key (re-wrap). | S | — | old password stops working |
| 2.8 | **Enforced CSP + security headers** (see REDESIGN §7-H); no inline script without hash; `connect-src 'self'`. | M | SEC-5 | CSP enforced, app fully functional, no violations in E2E |
| 2.9 | *(optional, F-21)* WebAuthn PRF unlock as an extra wrap; password fallback. | L | — | works on supported browsers, degrades cleanly |

## Phase 3 — Design system & redesign (details in REDESIGN §3–§5)

| ID | Item | Size | Accept |
|---|---|---|---|
| 3.1 | Tokens, self-hosted Plex + Noto Sans Bengali, **Paper/Vault** themes applied pre-paint; remove the other 3 themes and the old gradient/glow utilities. | M | D6; both themes pass contrast table; no FOUC |
| 3.2 | **AppShell** as a layout route; routes restructured (`/`, `/app/*`, redirects from old paths); command palette (cmdk), keyboard map, mobile bottom tabs. | L | every route reachable by keyboard; old URLs redirect |
| 3.3 | **Currency/number provider** + `<Money>`; digits (0–9/০–৯) × grouping (intl/lakh-crore); minor-unit aware (needs 1.6). | M | one formatter app-wide (lint rule bans `Intl.NumberFormat` outside it) |
| 3.4 | **Categories manager** (add/rename/colour/icon/archive/merge), entries linked by id; render stored icons. | M | rename keeps history |
| 3.5 | **Overview**: StatementStrip, RankedBars, CashFlowChart, upcoming/insights/budget-watch, month selector, QuickEntryBar. | L | matches REDESIGN §5.4; table fallbacks for charts |
| 3.6 | **Entries**: LedgerTable (virtualised, banded, keyboard), Undo toast, filters + saved views, bulk bar, CSV of current view. | L | 10 k rows smooth; keyboard-complete |
| 3.7 | **Budgets v2**: periods, rollover, thresholds, projection, ProgressRule. | M | regression test for BUG-3 |
| 3.8 | **Settings** split into Appearance / Security / Data / Region / About; atomic import wizard with preview. | M | import uses 1.3/1.4 |
| 3.9 | **Create & Unlock screens** + the **Seal** unlock moment; failed-attempt backoff; erase flow retained. | M | reduced-motion respected |
| 3.10 | **Accessibility + design-critique pass** (axe, manual keyboard, screen reader spot-check, Vault-theme contrast, hover/disabled states). | M | axe 0 critical/serious; findings logged |
| 3.11 | **i18n** EN + বাংলা (message catalogue, locale-aware dates/numbers, native-speaker review). | L | no hard-coded UI strings; language switch persists |

## Phase 4 — Feature depth (pick à la carte; see REDESIGN §6)

| ID | Item (F-ref) | Size | Depends |
|---|---|---|---|
| 4.1 | **PWA**: manifest, service worker precaching shell + WASM, install prompt, `navigator.storage.persist()` request, offline E2E (F-4) | M | 2.8 |
| 4.2 | **Accounts & transfers** (F-7) | L | 1.1 |
| 4.3 | **Recurring** + subscriptions (F-8) — runs due items on unlock | L | 4.2 |
| 4.4 | **Reports** + printable statement (F-11, F-24) | L | 4.2 |
| 4.5 | **CSV import wizard** + exports (F-12) | L | 1.3, 1.4 |
| 4.6 | **Natural-language quick-add** (F-9) | M | 3.5 |
| 4.7 | **Insights** (F-15) | M | 4.4 |
| 4.8 | **Goals** (F-16) | M | 4.2 |
| 4.9 | **Dena-Paona** (F-17) — validate demand first | L | 4.2 |
| 4.10 | **Attachments** (F-18) | L | 2.3 |
| 4.11 | **Undo/redo** (F-20) | M | 1.4 |
| 4.12 | Owner-gated extras: multi-currency (F-19), encrypted file sync (F-22), split bills (F-23) | L–XL | per item |

## Phase 5 — Showcase packaging (details in REDESIGN §7–§8)

| ID | Item | Size | Accept |
|---|---|---|---|
| 5.1 | **Public landing at `/`**, **demo vault** (seeded BDT data, separate storage key, reset), **Prove-it panel** (needs 2.3) | L | works signed-out; zero third-party requests |
| 5.2 | `/security`: threat model, limits, "verify it yourself" steps | M | every statement true and testable |
| 5.3 | `/case-study` (REDESIGN §8) with CI-generated numbers | M | numbers come from CI artefacts |
| 5.4 | SEO & sharing: `og:image`/`twitter:image` (1200×630), canonical, `theme-color`, JSON-LD, sitemap (public only), `robots` disallow `/app`, **prerender** `/`, `/security`, `/case-study` | M | link preview renders; Lighthouse SEO ≥ 95 |
| 5.5 | **Repo polish**: README from verified facts, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue templates, badges, topics, social preview, GIF (privacy-scrub all media) | M | D7 |
| 5.6 | **CI quality gates**: Playwright E2E (create → add → lock → unlock → edit → import/export → offline → erase), axe, Lighthouse CI, bundle budget | M | gates enforced on PRs |
| 5.7 | **Demo video (30–45 s) + 4 screenshots** | M | captions; shows "nothing sent" |
| 5.8 | **Launch checklist** (REDESIGN §7 Z), tag `v1.0.0` | S | all boxes ticked |

## 2. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Legacy-vault migration loses data | M | **High** | mandatory backup, verify round-trip before deleting, interruptible + idempotent, test with fixtures |
| Forgotten password/recovery key = permanent loss | H (inherent) | High | clear UX, recovery key, encrypted backups, honest copy |
| Scope creep from the feature list | H | M | features gated by decision D*, à-la-carte Phase 4, one slice at a time |
| Strict CSP breaks Radix/framer inline styles | M | M | validate early in 0.4 (report-only), use hashes/nonce-free patterns, test in CI |
| Safari/iOS storage eviction (7-day / low-space) | M | High | `storage.persist()`, backup reminders, clear messaging; document limitation |
| Bangla fonts/digit alignment in tables | M | M | test tabular alignment early (3.1), native-speaker review (3.11) |
| New palette reads as "spreadsheet" | L–M | M | prototype before D6; adjust band contrast/type scale |
| Argon2 WASM dependency adds weight / CSP needs | L–M | M | D4 fallback to PBKDF2; lazy-load only on unlock |
| Demo/seed data looks fake | L | M | handcraft believable data; reviewed copy |
| Claims drift again | M | **High** | claims review in the Definition of Done; CI-generated numbers; docs updated per slice |

## 3. Definition of done (every item)

1. `pnpm typecheck`, `pnpm lint`, tests and `pnpm build` pass; bundle budget not regressed.
2. New/changed behaviour has tests (unit for pure logic, E2E for flows once 5.6 exists).
3. Accessibility floor met for touched UI (keyboard, focus, labels, contrast, reduced motion).
4. No new third-party network request; no new `any`; money/date/currency only via the shared helpers.
5. The affected `docs/ai/*` files (and CURRENT-STATE finding status) are updated **in the same change**.
6. Any user-facing claim touched has been re-read against the code.
7. Hand-off: files staged/left for the owner — **agents never commit or push** (see GUIDELINES).

## 4. Suggested first slice (once decisions P, D1, D2, D3 are made)

`0.1 → 0.2 → 0.3 → 0.4` (≈ one session, immediate credibility win, no design decisions needed), then `0.5` (safety net) before touching anything structural.
