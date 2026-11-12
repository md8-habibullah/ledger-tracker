# Redesign, new features & agency-showcase guide (A → Z)

> Based on the audit in [CURRENT-STATE.md](./CURRENT-STATE.md) (commit `8b21342`, 2026-11-11). Items are sized **S / M / L / XL** (relative effort, not calendar promises). Execution order lives in [ROADMAP.md](./ROADMAP.md).
>
> **Status (2026-11-11): the design direction (§3), the page plans (§5) for the public site, Overview, Entries, Budgets, Categories, Settings, Create and Unlock, and the security and data features were implemented.** The owner approved implementing everything in one instruction, so the design direction was applied **without a prototype review**; treat it as provisional until the owner has seen it. The text below is the original proposal and is kept for its reasoning. Where it differs from the build:
>
> * **Not built:** command palette, Bangla language switch and digits, PWA/offline install, accounts and transfers, recurring entries, reports and printable statements, CSV import, goals, attachments, saved views, virtualised tables, `og:image`, prerendered pages, Playwright/axe/Lighthouse gates, demo video. See [ROADMAP §S](./ROADMAP.md) for each item.
> * **Measured so far:** entry JS 381 kB (120 kB gzip) against the 170 kB target; zero third-party requests on the landing page (measured) and no CSP violations on the other routes I used; no horizontal overflow at 375 px on any route; no console errors on the production build. **Not measured yet:** Lighthouse scores, axe results, LCP on a phone profile, offline behaviour (there is none), Safari and Firefox.
> * **Brand:** "Ledger Tracker" kept; no agency credit is shown until `SITE.agency` in `src/config/site.ts` is set (decision D7).

## Summary

This document contains: (1) an honest assessment of the current design, (2) the proposed design direction, (3) what changes on each page, (4) the prioritised feature list, (5) an A→Z checklist for the agency showcase.

**The most important point:** the app currently describes itself as "military-grade encrypted", but nothing is encrypted and passwords are stored in plaintext. A client's technical reviewer who opens DevTools → Application → IndexedDB will see this immediately, so showcasing the app before fixing it would reduce trust instead of building it. Once fixed, the same project becomes a strong portfolio piece, because the gap between *claiming* and *proving* is exactly what clients look for.

**Proposed order:** (0) truthful copy + cleanup → (1) fix the data layer → (2) real encryption → (3) new design system and page redesign → (4) new features → (5) showcase packaging (landing, demo, case study, SEO, video). A faster "Honest MVP" path also exists - see [ROADMAP.md](./ROADMAP.md).

---

## 1. Goals and audiences

| Audience | What they want in 60 seconds | What loses them |
|---|---|---|
| **Agency prospect / client** (non-technical decision-maker) | "These people ship polished, thoughtful products." Fast, beautiful, clear, works on a phone. | Generic template look, broken states, mixed currencies, slow load, jargon. |
| **Client's technical reviewer** | Real engineering: tests, security done right, clean repo, honest limits. | Claims that DevTools disproves; unpinned third-party scripts; no tests/CI. |
| **End user** (privacy-minded, Bangladesh-first) | Track money quickly, in BDT/Bangla, offline, nothing leaves my device. | Friction on every entry, data loss, no backup, confusing lock. |

**Showcase success criteria (measurable, to be produced by CI - never typed by hand):** Lighthouse ≥ 95 (mobile) on Performance/Accessibility/Best-practices/SEO for the landing page; axe: 0 critical/serious; LCP < 2.0 s on a mid-range phone profile; initial JS ≤ 170 kB gzip (today 344 kB); full E2E green incl. offline; zero network requests from app code after load (CSP-enforced).

**The one idea:** *the claim is the proof.* Every promise the product makes is something a visitor can verify in the page itself (see the "Prove it" panel, §5.1). That is the memorable thing; everything else stays quiet and disciplined.

## 2. Honest diagnosis of the current design

From `public/s-*.png` (older UI, same visual language) and the code:

* **Looks like the default dark SaaS dashboard**: navy background, cyan→emerald gradient, translucent "glass" cards of identical radius, glow shadows, a gradient-accented full stop after every title (`Ledger.`), fade-and-slide entrances everywhere. It is competent but anonymous - nothing says *ledger*, *vault* or *Bangladesh*.
* **Four identical stat cards** and a donut chart carry the Overview; the donut is the weakest way to compare 3–12 categories.
* **Two giant −/+ buttons** dominate the top of the dashboard but a real entry needs 3 more fields - high visual weight, low efficiency.
* **Inconsistent numbers** (BDT in cards, `$` in lists, 0-decimals vs 2-decimals) - the fastest way to look unprofessional in a finance product (BUG-2, DATA-7).
* **Five colour themes** (dark/light/ocean/forest/sunset) dilute the identity and multiply QA; the saved theme isn't even applied on load (BUG-1).
* **Landing/Login** use a different palette and typography feel (slate, all-mono) from the app.
* **No mobile-first interaction** (sidebar sheet only), no keyboard flow, no command palette, no empty-state guidance.

## 3. Design direction - "Banknote"

> **Superseded direction (2026-11-11).** The first redesign ("Green-bar Ledger": ruled pages, banding, no glows, brass seal) was built and verified, but the owner found it flat and asked for an eye-catching, next-generation look. This section now describes what is built. The old direction's rules ("no gradients as decoration, no glows") no longer apply; its accessibility, figures-first and "verify, don't claim" principles do.

### 3.1 Why this direction (grounded in the subject)

A vault that protects money should look like **money that cannot be forged**. A banknote's defences are visual: a holographic foil edge that changes colour with the angle you look from, microprint, a seal. The design borrows those devices as *ornament with a job*: the foil edge says "authentic", the microprint strip repeats the privacy facts. Content floats on **glass panels over a slow aurora**, in a dark theme (Vault) and a light one (Pearl). The hero is a small stack of tilting glass cards (a ledger, a lock card, a money in/out chart) rather than an emblem.

**Owner's standing visual rules (do not reverse):**
1. **No star, starburst or rosette ornaments, anywhere** (2026-11-11; the guilloche rosette was removed for this reason). Do not reintroduce star-like decoration for "security"; use glass cards, soft colour pools (`Glow`), the edge and the brand logo instead.
2. **Three colour families and no more (2026-11-12; this replaces the 2026-11-11 palette rule).** The owner looked at the emerald / lime / lemon / tangerine / coral / raspberry mix and rejected it: "thousands of colour mix up", not professional, and nothing matched their logo; they asked for 2 or 3 colours across the whole site, matched to the logo, in both themes. So the product uses: **indigo** (the logo's own `#5a5da9`), **slate** (the logo's `#6d7987`, plus the cool slate-tinted neutrals for surfaces and text) and **one red** (money out, "over budget", errors, destructive actions, and its lighter step for "close to the limit"). Nothing green, yellow, orange, cyan or purple anywhere, in code or in data defaults. `src/theme/palette.test.ts` fails the build on a colour outside those families. The earlier ban on indigo/navy no longer applies: the logo's indigo is now the brand colour of the whole system.
3. The owner approved the landing copy ("Watch it prove itself.", "Check it yourself.", "Built for taka, built to stay out of the way.", "Dark and light", "See it with sample data.") and the theme name **Pearl** (2026-11-11).

### 3.2 Plan (compact token system)

**Themes.** Vault (dark, id `vault`, default for the landing) and Pearl (light, id `paper`; the id is kept so saved preferences keep working, only the label changed). All tokens are HSL triplets in `src/index.css`.

| Role | Pearl (light) | Vault (dark) | Use |
|---|---|---|---|
| Background | `220 20% 96.5%` (`#f4f5f8`, cool pearl) | `212 17% 7.5%` (`#101316`, slate graphite) | page; aurora and film grain sit on top of it. `index.html` `theme-color` metas match |
| Foreground | `224 32% 10%` | `220 24% 95%` | text |
| Primary | `238 31% 51%` (the logo indigo) | `238 62% 79%` (a light tint of it) | links, active states, focus ring |
| Primary button | solid indigo `238 31% 53%` → `238 31% 47%`, white text | `238 32% 55%` → `238 31% 50%`, white text | `.btn-primary` (same hue in both themes, so the button is the brand colour everywhere) |
| Outflow / destructive | `350 68% 40%` | `350 100% 78%` | negative amounts, destructive actions, "over budget" |
| Warn (lighter red step) | `350 70% 52%` | `350 72% 60%` | "close to the limit" bar fill and nav badge (`bg-warn`) |
| Tonal ramp | `--foil-1..7`: indigo and slate steps (`238 31% 51%` … `212 14% 34%`) | lighter steps of the same two hues | glass edge, seal ring, gauges, glow pools. Kept the name `foil` so no component had to be renamed |
| Aurora | indigo top-left (`foil-2`), slate bottom-right (`foil-4`), indigo centre (`foil-1`); `--aurora-o` 0.3 | same tokens, `--aurora-o` 0.42 | `.aurora` |
| Chart in / out | `--chart-in` `238 31% 51%`, `--chart-out` `350 75% 60%` | `238 42% 62%`, `350 85% 76%` | chart marks only (indigo = money in, red = money out). Apart in lightness as well as hue (1.5:1 and 1.8:1) so greyscale and colour-blind readers can still tell them apart |
| Budget status | ok = indigo gradient, near = `--warn`, over = `--destructive` | same | `ProgressRule`; the words ("Within the limit", "Close to the limit", "Over budget") and a warning icon carry the status too |
| Category defaults | nine indigo and slate tones (`#5C5FAD` … `#818E9C`), each 3:1 or more with a white glyph and against both the Pearl page and the Vault card (`src/db/schema.ts` `DEFAULT_CATEGORIES`, `src/lib/icons.ts` `CATEGORY_COLORS`) | same | new vaults get these. Existing vaults keep the hex they stored, but it is **displayed** as the matching new tone (`src/lib/legacyCategoryColors.ts`, display only, nothing is rewritten). A colour the user typed themselves is shown as typed |

**Measured WCAG contrast** (script run on the real tokens, 2026-11-12). Surfaces tested: page; card; glass over the centre of the aurora with all three blobs stacked (the worst case, top and bottom of the glass gradient); the in-card `Glow` pools at peak strength. Lowest value across those surfaces:

| Pair | Pearl | Vault |
|---|---|---|
| Foreground text | 12.28 | 9.82 |
| Muted (secondary) text | 4.80 | 4.85 |
| Primary (links) | 4.55 | 5.09 |
| Outflow red | 5.47 | 5.11 |
| Button text on gradient ends | 5.33 / 6.66 | 4.90 / 6.05 |
| Button against the page (3:1 bar for UI) | 6.11 | 3.08 |
| Input border on a card (3:1 bar for UI) | 4.21 | 3.39 |
| Chart marks on a card, in / out (3:1 bar) | 5.80 / 3.76 | 4.34 / 7.66 |
| Warn fill on a card (3:1) and badge text on it (4.5:1) | 4.68 / 4.68 | 4.60 / 4.95 |

Every text pair clears AA (4.5:1) in both themes. `src/theme/palette.test.ts` re-checks all of these from the real CSS on every `pnpm test` (page, card, button, charts, warn, input border, secondary text on each glow pool at its peak strength) and also fails on any colour outside the three families, in the tokens, in hex and `hsl()` literals in `src/`, and in Tailwind palette classes. The stacked-aurora worst case is **not** in the test (it needs the aurora geometry): after changing `--aurora-o`, `--glass-a1/a2`, `--glow-a*` or the `--foil-*` that the aurora uses, re-run an equivalent check by hand. In the browser, a computed-style audit of every element on every page in both themes found no colour outside the three families (a deliberately injected green, lime and yellow element was caught by it).

**Type.** Unchanged: IBM Plex Sans Condensed 600 (titles, fluid `clamp()` sizes up to 5.4 rem in the hero), IBM Plex Sans (body, 15 px base), IBM Plex Mono 500 with tabular numbers for figures, Noto Sans Bengali fallback. All self-hosted. A distinctive variable display face would add impact but is a new dependency, so it needs the owner's approval.

**Shape.** Radius scale: sm 8 · md 12 · lg 20 · xl 28 · 2xl 34 px, with pills (`rounded-full`) for the floating header, dock, bottom bar, quick-entry field and buttons.

**Signature devices (all in `src/index.css` + `src/components/fx/`):**

| Device | What it is | Notes |
|---|---|---|
| `.glass` | translucent panel with backdrop blur and a 1 px conic edge in the indigo/slate ramp | the edge's hue angle follows the pointer (`--ang`, `--mx`, `--my`, set by `GlowTracker` on the hovered panel only) |
| Aurora | three slow-drifting radial blobs behind everything (`Aurora`) | transform-only animation, no blur filter |
| `Glow` | soft pool of indigo and slate tint (three stacked radial gradients, no filter) behind a card's content (`src/components/fx/Glow.tsx`) | replaces the removed rosette; strength is a per-theme token so secondary text on it keeps 4.5:1 |
| Hero cards | layered glass cards that tilt toward the pointer with a sweeping `.sheen` (`src/components/landing/HeroCards.tsx`) | pointer tilt is off for touch and reduced motion; on phones the lock card sits in flow above the ledger card |
| Logo mark | the owner's ledger-book-with-rising-arrow logo, from their own vector files (`src/components/brand/LogoMark.tsx`, `docs/brand/`, §3.4) | brand spot everywhere, transparent (`Logo`), ink follows the theme |
| Seal | foil-gradient ring and keyhole, optional glow and pulse rings | the **functional** lock/unlock indicator (status pill, unlock screen, "Seal a sample"); not the brand mark |
| Count-up | `Money animate` / `useCountUp` | eases from 0 once; instant under reduced motion |
| Microprint | repeating privacy facts in the public footer | decorative; the same facts are real copy elsewhere |
| Film grain | SVG noise as a `data:` URI on `body::before` | allowed by the CSP (`img-src data:`); inverted in Pearl |

Buttons: `.btn-primary` (solid brand-indigo pill, white text, soft lift), `.btn-glass` (outline). `.well` is an inset sub-surface, `.text-foil` and `.glow-text` are decorative text treatments (never used for essential small text).

**Motion.** One staggered page-load rise on the hero, ambient aurora drift, the hero cards' float and sheen, count-up on balances, and responses to action. Everything is transform/opacity only. No effects on touch devices (pointer glow) or under `prefers-reduced-motion` (CSS rule plus JS checks in `GlowTracker` and `useCountUp`).

**Layout concept.** Public pages: a floating glass pill header, a hero with the layered glass cards, bento tiles. App: a floating glass dock (left, ≥ md; see 3.5), a glass status pill on top (vault status + New entry), a floating bottom bar on phones; the Overview is a bento (hero balance tile, in/out/kept stack with sparklines, cash-flow, ranked spending, budgets, insights). Left-aligned content, figures right-aligned in tables.

**Principles**
1. Figures are the hero: large, mono, aligned, never rounded silently.
2. Ornament carries meaning (the fine edge = authentic); nothing is placed only to fill space, and never a star-like shape (owner's rule).
3. Verify, don't claim: any trust statement links to something the user can check. Effects must never imply a security property the code does not have.
4. Keyboard and thumb first: `N` and quick entry everywhere, `g` + letter to jump between pages, bottom bar on phones, visible 2 px focus outline.
5. Performance is part of the look: transform-only animation, one delegated pointer listener, no per-element blur filters.

### 3.3 Decisions and what was rejected

| Draft | Decision |
|---|---|
| Ruled "Green-bar" pages with banding and no glows | **Replaced** (owner feedback: flat, not eye-catching) |
| Neon mint for chart marks | **Rejected**: failed the dataviz lightness band and light-theme contrast (2.17:1) |
| Navy/cyan/violet palette, then cyan-on-dark | **Replaced** 2026-11-11 (owner: "common AI colour") by an emerald / lime / lemon / tangerine / coral / raspberry mix |
| Emerald / lime / lemon / tangerine / coral / raspberry mix | **Replaced 2026-11-12** (owner: "thousands of colour mix up", unprofessional, not matching the logo; wants 2 or 3 colours). Now indigo + slate + one red. Money in is indigo and money out is red; the green/raspberry chart pair, the lime primary button, the tangerine "near" state and the multi-hue category defaults are all gone |
| Guilloche starburst rosette and the orb built from it (`Guilloche`, `src/lib/guilloche.ts` and its tests, `VaultOrb`) | **Removed** (owner: no star-like ornaments); files deleted, replaced by `Glow` and `HeroCards` |
| One red for both "close to the limit" and "over budget" at the same strength | **Rejected**: two steps of the one red (`--warn` lighter, `--destructive` strongest) plus words and an icon, so "close" never looks as alarming as "over" |
| Remapping stored category colours with a data migration | **Not done**: display-only remap instead (no schema or data change, so no owner approval needed); a migration can still be added if the owner wants stored values updated |
| `backdrop-filter` blur on every nested element | **Limited** to panels and overlays; aurora uses plain gradients |
| Text in foil gradients | **Limited** to large decorative headings; body and small text stay in plain text tokens |

### 3.4 The owner's logo

**Source of truth (2026-11-12): the owner's own vector files**, kept untouched in `docs/brand/originals/` (`lt01` to `lt04`, an open ledger book with a rising trend arrow in indigo `#5a5da9` and slate `#6d7987`, plus a "LEDGER TRACKER" wordmark). Everything shipped is derived from them by `docs/brand/build-logo-kit.py` and guarded by `src/components/brand/logo.test.ts`, which fails if a shape, a colour or a file drifts from the originals. This replaced an earlier approximation redrawn from 64 px PNGs.

* **One variable: the ink.** The page edges and base line are black `#000000` on light surfaces (the owner's `lt04`) and white `#ffffff` on dark ones (the owner's `lt02`): each theme is built from its own file and a test checks both. Indigo and slate never change. The wrong ink disappears (black on Vault 1.08:1, white on Pearl 1.07:1).
* **In the app:** `Logo` is the owner's **transparent mark everywhere, with no tile or box** (headers, sidebar, hero card, splash, Settings). The ink follows the theme through `--logo-ink`: black on Pearl, white on Vault. `LogoMark` takes `tone` (`auto` default, `on-light`, `on-dark`) for a surface you control. Shapes live in the generated `src/components/brand/logoGeometry.ts`.
* **Files:** `public/brand/mark-on-light.svg` and `mark-on-dark.svg` (transparent) with 512 px PNGs; `favicon.svg` and `/logo.svg` (transparent, ink follows the browser's or viewer's light/dark scheme; `favicon.svg` is the first-paint default); `favicon-light.svg` (lt04, black edges) and `favicon-dark.svg` (lt02, white edges), which the app swaps in to match its own theme button; `favicon.ico` (fallback, dark ink); `apple-touch-icon.png` (white ink, since iOS puts black behind transparency). Index links carry `?v=3` so browsers refresh the old icon.
* **Visibility:** ink switches, never the ground. Measured contrast and the full rules are in `docs/brand/README.md`; `docs/brand/logo-sheet.html` shows every file on every surface.
* **Not done: the wordmark.** The supplied files hold it as live text in Satoshi Black (no font, no outlines), and it is white in all four, so it is invisible on the two light variants. No lockup ships until the designer sends outlined text (and a dark wordmark for light surfaces). The header sets the name in the app's own type.
* **Proposed, not yet confirmed by the owner:** the usage rules (clear space, no effects, no second colour) in `docs/brand/README.md`.

### 3.5 The sidebar (owner asked for more, 2026-11-12)

The desktop dock was five links and a Lock button with a large empty gap. It now holds only things the open vault can back up, all computed on the device with no new data, schema or dependency:

| Part | What it shows | Notes |
|---|---|---|
| Nav badges | Entries: count dated this month. Budgets: number of budgets at 80% or more of their limit, as a light-red (near) or red (over) pill | spoken in full ("Budgets 1 near or over the limit"); the phone bar gets a matching dot |
| `g` + letter | `g o` Overview, `g e` Entries, `g b` Budgets, `g c` Categories, `g s` Settings; hints appear on hover, focus, and on every link while `g` waits (1.5 s) | ignored while typing, with a modifier, or while a dialog is open; any other key cancels |
| This month card | kept or overspent so far, a money in / out bar (2 px gap, words carry the meaning), in and out figures, day of the month | same stats as the Overview |
| Budget watch | the three budgets closest to their limit: category mark, name, period (wk/mo/yr), percentage, thin gauge; over-limit rows add a warning icon and say so | "Set a limit" link when there are none |
| Theme switch | System / Pearl / Vault | same preference as Settings → Appearance |
| Icon rail | the dock collapses to 68 px (icons, tooltips, alert dots), remembered per device in `lt:sidebar` | the grid column switches instantly (animating it would re-lay-out the charts every frame) |

Short screens (under 760 px tall) tighten the link height and gaps so the cards keep a usable scroll area; the links and the Lock button never scroll away. Not built, on purpose: a "hide amounts" toggle (amounts are formatted in many places, including chart axes and insight sentences, so a partial hide would overstate privacy) and a backup reminder (the vault does not record when a backup was last exported; that would need a stored setting, so ask first).


### 3.4 Design system spec (what to build - roadmap 3.1)

* **Tokens** as CSS variables (HSL triplets kept so Tailwind/shadcn keep working): colour roles above × 2 themes (`data-theme="paper|vault"` + system default), `--radius-sm/md/lg/xl`, `--glass-*`, `--foil-1..7`, spacing on a 4 px base, type scale, motion durations/easing, focus ring (2 px outline in the theme's primary colour, visible on every interactive element).
* **Replace the 5-theme system** with Pearl (id `paper`) / Vault / System. Apply the theme **before first paint** (a tiny *blocking external* script, e.g. `/theme-init.js`, or an inline script allowed by a CSP hash - an un-hashed inline script would violate the strict CSP in checklist item H) plus a root provider - fixes BUG-1 and removes the flash.
* **New/rebuilt components:** `AppShell`, `RuleSection` (a glass panel with a heading; replaces `Card` in app screens), `Money` (sign, red ink, tabular, locale-aware), `LedgerTable` (row dividers, sticky header, keyboard row navigation, virtualised), `EntrySheet` (add/edit; replaces dialog on mobile), `QuickEntryBar`, `StatementStrip`, `RankedBars`, `CashFlowChart`, `Sparkline`, `Seal` (lock indicator + unlock animation), `EmptyState`, `CommandPalette` (cmdk is already a dependency), `ConfirmUndo` (toast with Undo), `DateField` (local-date safe), `CategoryChip`, `ProgressRule` (glowing budget gauge with the status spelled out), `LocaleSwitch`.
* **One toast system:** sonner only (delete the Radix toaster).
* **Delete unused primitives** (31) and re-add via the shadcn CLI only when needed.
* **Money & number display rules:** always the vault currency; 2 fraction digits for currencies with minor units (never silently 0); true minus `−` (U+2212); outflows in Red ink, inflows in Ink; right-aligned tabular. A *Display* setting chooses **digits** (0–9 / ০–৯) × **grouping** (international 1,234,567 / lakh-crore 12,34,567); verify `Intl` output (`en-BD`, `bn-BD`, `en-IN`) in target browsers.
* **Charts:** recharts stays; style via tokens; every chart has a table fallback for screen readers; money in is `--chart-in` (indigo) and money out is `--chart-out` (red), kept apart in lightness and contrast-tested by `palette.test.ts`; the legend and the table fallback carry identity, text never wears the series colour.
* **Density:** Comfortable / Compact toggle (ledger users want compact).
* **Accessibility floor (non-negotiable):** WCAG 2.1 AA contrast, full keyboard operation (rows focusable, sheet/dialog focus-trap - Radix gives this), visible focus, 44 px touch targets, `aria-label`s on icon buttons, reduced-motion, no colour-only meaning (outflow also has a `−` sign).
* **Voice:** plain, active, sentence case; buttons say what happens; errors say what to do.

| Today | Use instead |
|---|---|
| "Destructive Reset" / "Forgot password? Destructive Reset" | "Erase this vault" / "Can't unlock? Erase this vault and start over" |
| "1-Click Login as Demo" | "Open the demo vault" |
| "Vault created! Your encrypted vault has been created." | "Vault created. Save your recovery key now." (only once encryption is real) |
| "Welcome back." | "November so far" (date-aware, informational) |
| "Your vault will automatically lock after auto-lock is disabled of inactivity." (BUG-7) | "Auto-lock is off." / "Locks after 15 minutes without activity." |
| "Please fill in all fields" | name the missing field inline |
| "Failed to save transaction" | say why, and keep the typed values |

## 4. Information architecture (proposed routes)

Public (no vault needed): `/` landing · `/demo` (creates/opens the demo vault) · `/security` (threat model + how to verify) · `/case-study` · `/create` (vault creation wizard) · `/unlock` (lock screen) · `*` (404 with a way back).
App (needs unlocked vault): `/app` Overview · `/app/entries` · `/app/budgets` · `/app/accounts` · `/app/recurring` · `/app/reports` · `/app/goals` · `/app/categories` · `/app/settings/:tab` (`appearance|security|data|region|about`).

Why: `/` becomes a public, indexable marketing URL (today `/` is the gated dashboard → crawlers and shared links hit a redirect); `robots.txt` can `Disallow: /app`; the sitemap lists only public pages. Use a layout route for `AppShell` instead of wrapping each page. Keep `/login`, `/landing`, `/ledger` etc. as redirects for old links.

## 5. Page-by-page plan

Legend - **Keep / Change / New**. IDs point to findings in CURRENT-STATE.

### 5.1 Landing (`/`) - *public showcase hero* (today: `/landing`, dark mono page)

* **Change:** adopt the new tokens/type; move to `/`; replace every unverifiable claim; rewrite FAQ truthfully (forgot password → recovery key or erase; what it does **not** protect against); remove "Military-Grade".
* **New hero = the Prove-it panel:** left, a plain-language promise + two actions (*Open the demo vault* / *Create your vault*); right, a live panel showing (a) **network activity since load** (from `PerformanceObserver` resource entries; the initial site files are listed separately; CSP `connect-src 'self'` is named as the real enforcement, because resource timing does not see WebSockets), (b) **what is stored on this device**: the first bytes of the vault blob as hex, next to the header a plaintext SQLite file would start with (`53 51 4C 69 74 65 20 66…` = "SQLite f…") so the viewer can see the stored bytes are ciphertext, (c) a one-click "airplane mode" instruction/test. Requires F-1 (real encryption) - until then the panel must not ship.
* **New sections (all real, no stock art):** "Verify it yourself" (3 facts × the exact DevTools steps), product tour built from live mini-components with demo data, "Built to be inspected" (CI-generated test/bundle/Lighthouse numbers + licence + repo link), honest "Limits" block, footer with agency credit and "Start a project" link (plain external `<a>`).
* **Accept:** Lighthouse ≥ 95 mobile; no third-party requests; every sentence is true on the day it ships; works at 360 px width.

### 5.2 Create vault (`/create`) - *new wizard* (today: Register tab + "Initialize Local Vault")

* 3 steps: name & currency (BDT default) → master password (strength meter, 12+ chars guidance, show/hide) → **recovery key** (download/print, "I saved it" gate). Plain explanation that there is no reset by design.
* **Accept:** password never stored; wizard cannot finish without choosing to save/skip recovery key with explicit consequence text; keyboard + screen-reader complete.

### 5.3 Unlock (`/unlock`) - *replaces `/login`*

* **Change:** one field (password) + vault name; **Seal** animation on success (the single orchestrated moment); failed-attempt backoff; "Use recovery key"; secondary text link "Erase this vault" (confirm flow kept: type `ERASE`, 10 s hold).
* **Remove:** Register tab on the lock screen, `demo/demo` credentials (SEC-7).
* **Accept:** no `localStorage` session; closing the tab = locked (key lives only in memory).

### 5.4 Overview (`/app`) - today `Index.tsx`

* **Change:** replace 4 cards with one **StatementStrip** (Balance · This month in/out · Net · Savings rate, each with a 6-month sparkline); replace donut with **RankedBars** (top categories, inline amounts, vs last month); area chart → **CashFlowChart** (paired in/out bars per month with ruled grid) + tooltip table; heading becomes informational ("November so far · 11 days left").
* **Change:** QuickEntry becomes a persistent one-line **QuickEntryBar** (type · amount · category · note · date, Enter to save, `N` to focus) with natural-language parsing (§6 F-9).
* **New:** *Upcoming* (next recurring items), *Insights* (2–3 locally computed sentences: "Food is 18 % above October"), *Budget watch* (top 3 at risk), month selector (all totals respect it - BUG-10; **built 2026-11-12**: `PeriodPicker` with quick ranges and a month calendar, `?period=` in the URL, `src/lib/period.ts`).
* **Accept:** one currency everywhere; first meaningful paint with 5,000 entries < 300 ms after unlock; empty state guides first entry.

### 5.5 Entries (`/app/entries`) - today `Ledger.tsx`

* **Change:** `LedgerTable` - banded rows, sticky header, right-aligned tabular amounts, **virtualised** (BUG-5), no per-row stagger, focusable rows with Enter = details, `E` edit, `Del` delete + **Undo toast** (BUG-6), bulk bar appears on selection.
* **New:** date-range + amount-range + account + tag filters; **saved views**; column sort; group-by (day/category); inline edit of category/description; split entry; attachments (§6); running balance column; CSV export of the current view; calendar view toggle.
* **Accept:** 10,000 rows scroll at 60 fps; every action reachable by keyboard; same currency rules as Overview.

### 5.6 Budgets (`/app/budgets`) - today `Budgets.tsx`

* **Change:** honour `period` (weekly/monthly/yearly windows; BUG-3); **ProgressRule** gauges; unique per (category, period); derived spend via SQL query (no trigger); thresholds at 80 %/100 % produce an in-app notice (the README promised notifications); confirm on delete.
* **New:** rollover (carry unused/over), budget templates ("50/30/20"), month-by-month history for a budget, projected end-of-period spend ("at this pace you'll hit 112 %").
* **Accept:** a weekly budget ignores last month's spending (regression test).

### 5.7 Accounts (`/app/accounts`) - *new*

* Cash, bank, mobile-wallet, card, savings accounts (generic types; **no integrations claimed**); per-account balance; **transfers** between accounts (two linked entries, excluded from income/expense stats); opening balance; archive account.

### 5.8 Recurring (`/app/recurring`) - *new*

* Rules (daily/weekly/monthly/yearly/custom), next-run preview, auto-create due entries **on unlock** (no background process exists in a local app - state that clearly), "mark as paid" flow, subscription list with monthly/annual cost, flag unusual increases.

### 5.9 Reports (`/app/reports`) - *new*

* Monthly statement (printable, client-side PDF via print stylesheet), category trends, cash-flow, net worth over time, income sources, savings-rate history, year-in-review; each with table fallback and CSV export.

### 5.10 Goals & Dena-Paona (`/app/goals`) - *new, Tier B*

* Savings goals with target/date/auto-contribution suggestion. **Dena-Paona** (money lent/borrowed, per person, with partial repayments and due dates) - a ledger-native, locally relevant feature (validate demand before building).

### 5.11 Categories (`/app/categories`) - *new, moved out of Settings*

* Add/rename/recolour/re-icon/archive; merge categories; per-type; **link entries by id** (DATA-9); the stored `icon` finally gets rendered; keyword rules for auto-categorising imported rows.

### 5.12 Settings (`/app/settings/:tab`) - today one 549-line page

* Split: **Appearance** (Paper/Vault/System, density, language) · **Security** (auto-lock incl. "lock when tab hidden", change password, recovery key, WebAuthn unlock (optional), view-security-status panel) · **Data** (encrypted backup/restore, CSV/JSON export, import wizard with preview, storage usage, request persistent storage, erase) · **Region** (currency, digits, grouping, first day of week, fiscal month start) · **About** (version, licence, source, agency credit).
* **Fix:** copy bug (BUG-7); import becomes validate → preview → atomic apply (DATA-4).

### 5.13 About → Case study (`/case-study`) and About tab

* Keep a short in-app About. Put the **case study** at `/case-study` (public): problem, constraints, decisions & trade-offs, architecture diagram, security model with limits, quality numbers (CI-generated), what the agency would do for a client, CTA. Remove the GitHub-avatar fetch (self-host a tiny avatar or none).

### 5.14 Global shell

* **AppShell:** slim left rail (labels ≥ 1280 px), top bar with **vault status** (foil seal + "Auto-locks in 12:40"), command palette trigger (⌘K / Ctrl K), `+ New entry` (`N`), month selector. **Mobile:** bottom tab bar (Overview · Entries · Budgets · Reports · More) + FAB for new entry; sheets instead of centred dialogs.
* **Keyboard map:** `N` new, `/` search, `G O/E/B/R` go-to, `?` shortcut sheet, `Esc` close.
* **404:** useful (search + recent routes). **Offline banner:** none needed (works offline) - show "Offline-ready" once the service worker has cached the shell.

## 6. Feature catalog (new & changed)

Value: ★ = user value · ◆ = showcase impact.

| ID | Feature | ★ | ◆ | Size | Depends |
|---|---|---|---|---|---|
| F-1 | **Real vault encryption** (KDF + AES-256-GCM, memory-only key, recovery key, encrypted backup) | ★★★ | ◆◆◆ | XL | Phase 1 |
| F-2 | **Prove-it panel** (live network counter removed 2026-11-12 on the owner's request; the seal-a-sample demo remains) | ★ | ◆◆◆ | M | F-1 |
| F-3 | **Demo vault** (realistic seeded BDT data, separate storage key, one-click reset, banner) | ★ | ◆◆◆ | M | Phase 1 |
| F-4 | **PWA**: installable, offline cold-start, `storage.persist()` | ★★ | ◆◆◆ | M | - |
| F-5 | **Design system + Paper/Vault themes**, applied pre-paint | ★★ | ◆◆◆ | L | - |
| F-6 | **Command palette + keyboard shortcuts** | ★★ | ◆◆ | M | F-5 |
| F-7 | **Accounts & transfers** | ★★★ | ◆◆ | L | Phase 1 |
| F-8 | **Recurring transactions & subscriptions** | ★★★ | ◆◆ | L | F-7 |
| F-9 | **Natural-language quick-add** ("rickshaw 80 yesterday") - local parser, no AI/network | ★★ | ◆◆◆ | M | F-5 |
| F-10 | **Budgets v2** (periods, rollover, thresholds, projection) | ★★★ | ◆◆ | M | Phase 1 |
| F-11 | **Reports** (statement, trends, net worth, year-in-review) | ★★★ | ◆◆ | L | F-7 |
| F-12 | **CSV import wizard** (column mapper, dedupe, preview, undo) & CSV/JSON export | ★★★ | ◆◆ | L | Phase 1 |
| F-13 | **Bangla UI + Bangla digits + lakh/crore grouping** | ★★★ | ◆◆◆ | L | F-5 |
| F-14 | **Categories manager** (id-linked, rules, merge) | ★★ | ◆ | M | Phase 1 |
| F-15 | **Insights** (locally computed sentences, anomalies) | ★★ | ◆◆ | M | F-11 |
| F-16 | **Goals** | ★★ | ◆ | M | F-7 |
| F-17 | **Dena-Paona** (lent/borrowed per person) | ★★ (validate) | ◆◆ | L | F-7 |
| F-18 | **Attachments** (receipt photos, stored encrypted, size-capped) | ★★ | ◆◆ | L | F-1 |
| F-19 | **Multi-currency per entry** with manual offline rates | ★ | ◆ | L | Phase 1 (D3) |
| F-20 | **Undo/redo** for entry changes | ★★ | ◆◆ | M | Phase 1 |
| F-21 | **WebAuthn unlock** (PRF extension; fall back to password) | ★ | ◆◆◆ | L | F-1 |
| F-22 | **Encrypted file sync** (File System Access API / WebDAV; still no vendor server) | ★★ | ◆◆ | XL | F-1 |
| F-23 | **Split bills / shared expenses** | ★ | ◆ | L | F-7 |
| F-24 | **Printable monthly statement** (print stylesheet, no server) | ★★ | ◆◆ | S | F-11 |

Rule of thumb for scope: **F-1, F-2, F-3, F-4, F-5, F-13** make the showcase credible and distinctive; **F-7, F-8, F-10, F-11, F-12** make it a *real* product; the rest are optional depth. Do not build F-19, F-22, F-23 before the owner confirms they matter.

**Changes to existing behaviour worth approving** (owner decisions, see ROADMAP D1–D8): remove 3 of 5 themes; move `/` to a public landing and the dashboard to `/app`; drop multi-user-in-one-file for per-vault passwords; store money as integer minor units; stop trigger-maintained `spent_amount`; remove the third-party launcher script; replace the donut chart; require a recovery-key decision at vault creation.

## 7. Showcase checklist A → Z

Tick in order of [ROADMAP.md](./ROADMAP.md); each line is verifiable.

**A - Accessibility.** axe 0 critical/serious on every route; keyboard-only run-through recorded; contrast table committed; reduced-motion honoured; Bangla screen-reader labels.
**B - Brand.** Decide name (keep "Ledger Tracker" or brand it; check trademark/app-store collisions - "Khata"-style names are crowded in the ledger-app space); logo/favicon set (SVG, 32/180/512 PNG), `theme-color`, one accent system, consistent voice.
**C - Claims policy.** Every public sentence is true and checkable; claims about security are written *after* the feature ships; a "Limits" section is mandatory; nothing is called "military-grade".
**D - Demo.** One-click demo vault with believable BDT data (salary, rent, bKash-style "mobile wallet" account type, utility bills - generic wording), banner "Demo data - stays in this browser", reset button; works with no sign-in.
**E - Empty & error states.** Every list/chart has a guiding empty state; errors name the cause and the fix; offline/blocked-storage states handled (private mode, quota exceeded).
**F - Fonts & assets.** Self-host Plex + Noto Sans Bengali (`@fontsource`), subset, `font-display: swap`, preload the primary; no Google Fonts; no third-party scripts, images or iframes.
**G - GitHub repo.** README rewritten from the verified facts (live-demo badge, CI badge, GIF, honest feature list, architecture diagram, run instructions with port 8080), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` (Keep-a-Changelog), issue templates, topics, social preview image, licence (MIT) consistent everywhere. Use the repo-launch playbook; privacy-scrub screenshots.
**H - Headers.** Vercel `headers`: strict CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`), `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. (Tailwind/Radix inline styles may need nonces/hashes - validate.)
**I - i18n.** EN + বাংলা, locale-aware dates/numbers; keys extracted; no string concatenation.
**J - JSON-LD & structured data.** `SoftwareApplication` for the product on the landing page; optional `Organization` for the agency (only with accurate data).
**K - Keyboard & shortcuts.** Documented in-app (`?`), consistent, discoverable.
**L - Lighthouse CI.** Budget enforced in CI (Perf ≥ 90 hard fail, ≥ 95 target); bundle-size budget; route-level code splitting; WASM loaded after the landing renders.
**M - Mobile.** Designed for 360 px first; bottom tab bar; sheets; safe-area insets; 44 px targets; tested on a low-end Android profile.
**N - Network hygiene.** Remove the jsDelivr launcher (or vendor + pin with SRI if the agency widget is wanted *on the agency site only*); remove GitHub avatar fetch; Prove-it panel reports zero.
**O - Offline.** Service worker precaches the shell + WASM; airplane-mode test in E2E; install prompt; `navigator.storage.persist()` requested after first entry with an explanation.
**P - Performance.** Initial JS ≤ 170 kB gz; lazy routes; lazy charts; virtualised tables; WASM streaming; no layout shift (reserve chart heights).
**Q - Quality gates.** CI (typecheck, lint, unit, E2E, axe, Lighthouse, build) green on every push; coverage on money/date/crypto/stat code ≥ 90 %.
**R - Recovery & backup.** Recovery key at creation; encrypted backup export/restore; backup reminder after N entries; restore tested in E2E.
**S - SEO & social.** Public `/` indexable; unique `<title>`/description; canonical; **`og:image` / `twitter:image` 1200×630**; sitemap lists public pages only; `robots.txt` disallows `/app`; prerender or static HTML for `/`, `/security`, `/case-study` (e.g. SSG plugin) so previews/crawlers see content, not an empty shell.
**T - Tests.** Vitest (stats, money, dates, crypto envelope, migrations, import validator) + Playwright (create → add → lock → unlock → edit → import/export → offline → erase) + axe in E2E.
**U - UX copy.** Voice guide applied (see §3.4); microcopy reviewed in Bangla by a native speaker.
**V - Video & visuals.** 30–45 s screen-recorded walkthrough (create vault → entry → lock → airplane mode → "nothing sent") with captions; 4 clean screenshots at 2×; animated GIF for the README; consider producing it with the HyperFrames tooling.
**W - Website integration (agency).** Portfolio card: title, one-sentence outcome, 3 proof points, live link, video, "Read the case study". **Link out** to the demo rather than embedding it in an `<iframe>` (third-party iframes get partitioned/blocked IndexedDB and break the vault).
**X - eXpectation-setting.** Privacy page states exactly what is and isn't collected; if the hosting domain runs analytics (configured outside this repo), say so plainly and keep the app origin free of it so the "app sends nothing" claim stays literally true.
**Y - Year-proofing.** Dependency update cadence (Renovate/Dependabot config), Node/pnpm pinned via `packageManager`/`engines`, browserslist refresh, licence audit of fonts/deps, `SECURITY.md` contact.
**Z - Zero-surprise launch.** Pre-launch checklist: fresh-profile run, Safari + Firefox + Chrome + Android Chrome, private-mode behaviour, storage-eviction message, 404/redirect map for old URLs, final claims review, tag `v1.0.0`.

## 8. Packaging the case study (what makes clients trust "we can build this")

1. **Context & goal** - one paragraph; who it's for; why local-first.
2. **Constraints** - no server, privacy, low-end phones, Bangla, offline.
3. **Decisions & trade-offs** - SQLite-WASM vs IndexedDB-only; whole-blob encryption; PBKDF2 vs Argon2id; why no sync server; why integer money.
4. **Architecture diagram** - simplified from ARCHITECTURE §3.
5. **Security model with limits** - what's protected, what isn't (XSS/extension in an unlocked session, weak passwords, device compromise).
6. **Quality evidence** - CI badges, test counts, Lighthouse/bundle numbers (generated), accessibility statement.
7. **Process** - discovery → design system → build in slices → hand-over docs (this `docs/ai/` set is itself a deliverable clients value).
8. **Outcome & CTA** - "Have a product that needs this level of care? Start a project" → agency contact (external link).

## 9. How to execute (with AI assistance)

Design first as a clickable prototype/screenshots (Paper + Vault, Overview, Entries, Lock) and approve before coding; build the design system and one vertical slice (Unlock → Overview) end-to-end; review each slice with the accessibility and design-critique passes; use the browser DevTools driver to screenshot every route at 360/768/1280 px in both themes; chart work follows the data-viz guidance; microcopy gets a UX-copy pass; repo/SEO/domain work follows the repo-launch playbook. Rules for agents are in [GUIDELINES.md](./GUIDELINES.md).
