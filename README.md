# Ledger Tracker

A private money ledger that runs entirely in your browser. Track income, expenses and budgets in taka (or another two-decimal currency). Everything is encrypted with your password and stored on your own device. There is no account and no server holding your numbers.

It is a client-only React and TypeScript app. The database is SQLite compiled to WebAssembly, encrypted with AES-256-GCM, and stored in IndexedDB.

## What it does

- **Record in one line.** Type `tea 40` or `+85000 salary 1 nov` and press Enter. The line is parsed on your device.
- **Budgets that mean what they say.** Weekly, monthly or yearly limits, each counting only spending inside its own current period, with a straight-line forecast.
- **Your categories.** Rename, recolour, merge or archive. Entries follow the change.
- **Overview.** Balance, money in and out, six-month cash flow, top spending against last month, and plain-language notes worked out from your entries.
- **Taka first.** Amounts are stored as whole minor units (paisa), so totals are exact. Lakh and crore grouping, true minus signs.
- **Backups you control.** Download the encrypted vault file and restore it anywhere. Export entries as CSV, and import either file back.
- **Several vaults.** One password per vault, chosen from a list on the lock screen.
- **Demo vault.** Sample data in memory only. Nothing is written to the device.
- **Migration.** If a vault from the earlier, unencrypted version exists, it is encrypted into a new vault and checked against the original. The old copy is deleted only when you say so.
- **Two themes.** Pearl (light) and Vault (dark), with comfortable and compact row density.

## How your data is protected

Read the full threat model on the in-app [Security page](./src/pages/Security.tsx), including what it does not defend against. In short:

- A random 256-bit **vault key** encrypts the database with AES-256-GCM, using a fresh nonce on every save.
- The vault key is **wrapped** by a key derived from your password (PBKDF2-HMAC-SHA256, 600,000 iterations, random salt) and by a second wrapping from a 160-bit **recovery key**. Changing the password re-wraps the key and does not re-encrypt your data.
- Nothing derived from the password is stored for checking it. A wrong password is detected because decryption fails its authentication check.
- While unlocked, the decrypted database lives in the tab's memory only. Locking closes the database and reloads the page. There is no session persistence.
- The site ships a strict Content-Security-Policy (`connect-src 'self'`) and loads nothing from other origins. Fonts are self-hosted.

**Limits, stated plainly.** If you forget the password and lose the recovery key, the data cannot be recovered by anyone. Malware or a hostile browser extension on your device can read an unlocked vault. A compromised host could serve altered code, which is why the source is open and you can build and host it yourself. There is no sync between devices, browsers can clear site data (keep a backup file), and it has not had an independent security audit.

## Getting started

Requirements: Node.js 20 or newer, and pnpm (the version is pinned in `package.json`; `corepack enable` provides it).

```bash
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:8080
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 8080 |
| `pnpm build` | Production build into `dist/` |
| `pnpm typecheck` | `tsc --noEmit` for the app |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (crypto, database, vault service, helpers) |
| `pnpm check` | Typecheck, lint, tests and build in order |

`pnpm-workspace.yaml` lists the dependency build scripts that are allowed to run (`@swc/core`, `esbuild`).

## Project layout

```
src/
  crypto/      envelope encryption, recovery key, byte helpers        (+ tests)
  db/          SQLite wrapper, versioned migrations, repositories     (+ tests)
  vault/       vault service, storage, legacy import, demo data,
               React provider and data hooks                          (+ tests)
  lib/         money, dates, stats, CSV export and import, insights, quick-entry parser,
               password strength                                      (+ tests)
  theme/       theme and density provider
  components/  ledger/ (domain UI), layout/, auth/, landing/, ui/ (shadcn)
  pages/       public pages, unlock/create/migrate/demo, and the app pages
  config/      site identity (name, repository, optional agency credit)
public/        theme-init.js (pre-paint theme), robots.txt, sitemap.xml
docs/ai/       architecture, current state, roadmap, guidelines
vercel.json    SPA rewrite, security headers, Content-Security-Policy
```

Routes: public pages at `/`, `/security`, `/case-study`, `/create`, `/unlock`, `/migrate`, `/demo`; the app under `/app` (`entries`, `budgets`, `categories`, `settings/:tab`). Everything under `/app` renders only while a vault is unlocked in memory.

## Deploying

`pnpm build` produces a static site in `dist/`. Any static host works, but it must serve `index.html` for unknown paths and should send the headers in `vercel.json`, in particular the Content-Security-Policy. The security claims on the Security page depend on that header being present.

The CSP allows inline styles (`style-src 'unsafe-inline'`) because the UI libraries set style attributes at runtime. It does not allow inline or remote scripts.

## For contributors

Start with `docs/ai/README.md`. The rules that matter most:

- Do not state or restore a claim the code does not back (encryption, passwords, offline use, network behaviour).
- No third-party requests: no CDNs, hosted fonts, analytics or avatars. Self-host.
- Money, dates and currency go through the shared helpers in `src/lib`. Queries use bound parameters only.
- Update the affected files in `docs/ai/` in the same change.

Please report security problems privately through a GitHub security advisory on this repository rather than in a public issue.

## Licence

MIT. See [LICENSE](./LICENSE).
