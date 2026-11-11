import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SITE } from "@/config/site";
import { DEFAULT_PBKDF2_ITERATIONS } from "@/crypto/envelope";

const DECISIONS: [string, string, string][] = [
  ["No server", "Personal finance data is among the most sensitive a person has. The safest place for it is nowhere we control.", "No sync between devices, and the browser can clear storage. Encrypted backup files cover that."],
  ["Encrypt first, then build features", "An encryption claim that is not true is worse than none. The first release of this project said “military-grade” while storing plain text. It was audited, the claims were removed, and real encryption came next.", "Slower start; the product earned its marketing instead of borrowing it."],
  ["Whole-database encryption with a wrapped key", "One random key encrypts the data; the password only wraps that key. Changing the password is instant, and a recovery key is just a second wrapping.", "The database is loaded whole into memory while unlocked, which suits a personal ledger but not millions of rows."],
  ["Money as whole minor units", "Floating-point arithmetic gives 0.1 + 0.2 ≠ 0.3. Amounts are stored as integer paisa, so sums are exact.", "Every display and input goes through one money module; nothing formats a number by hand."],
  ["Calendar dates as plain strings", "Taking “today” from UTC is wrong after 6 pm in Dhaka. Dates are local calendar days, compared as text.", "No time-of-day on entries."],
  ["Constraints in the database, not only in the UI", "The schema itself rejects zero amounts, bad dates and dangling categories. A bug in the interface cannot corrupt the ledger.", "Migrations are versioned and each runs atomically."],
  ["Prove, don't claim", "The home page runs the real encryption on text you type, and every trust statement points to something you can check yourself.", "More work than a sentence, and it must stay true."],
];

const STACK = [
  ["React and TypeScript", "Interface"],
  ["SQLite compiled to WebAssembly", "Query engine, running in the tab"],
  ["Web Crypto (AES-GCM, PBKDF2, HKDF)", "All cryptography, no custom primitives"],
  ["IndexedDB", "Storage for ciphertext"],
  ["Vitest", "Tests for the encryption, the database layer, migrations and the legacy import"],
  ["Self-hosted fonts", "IBM Plex and Noto Sans Bengali, served from the same origin"],
];

export default function CaseStudy() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <p className="text-sm text-muted-foreground">Case study</p>
      <h1 className="mt-2 text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.08]">A finance tracker that can prove it keeps your numbers private</h1>
      <p className="mb-9 mt-4 max-w-prose text-base leading-6 text-muted-foreground">
        What it took to turn a prototype that claimed to be secure into one that demonstrably is, and what we chose not to do.
      </p>

      <section className="glass mt-5 grid gap-3 p-6 md:p-8" aria-labelledby="problem">
        <h2 id="problem" className="text-xl">The problem</h2>
        <p className="max-w-prose leading-6">Most finance apps ask for an account, keep everything on a server and make privacy a promise. We wanted a tracker where privacy is something you can check yourself, built for taka, with lakh and crore grouping.</p>
      </section>

      <section className="glass mt-5 grid gap-3 p-6 md:p-8" aria-labelledby="start">
        <h2 id="start" className="text-xl">Where we started</h2>
        <p className="max-w-prose leading-6">The first version looked finished: a dashboard, budgets, a lock screen. A review found that the lock screen was a curtain. The data was stored as a plain database, passwords were kept as readable text, a session could be restored without a password, a third-party script and font were loaded on every visit, and the marketing text promised encryption that did not exist. Budgets ignored their period and prices were shown in dollars in a taka app.</p>
        <p className="max-w-prose leading-6">We wrote that down, removed every claim the code could not back, and rebuilt on a foundation that makes the claims true.</p>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="decisions">
        <h2 id="decisions" className="text-xl">Decisions and trade-offs</h2>
        <ul className="grid gap-5">
          {DECISIONS.map(([title, why, cost]) => (
            <li key={title} className="grid gap-1">
              <p className="font-medium">{title}</p>
              <p className="max-w-prose leading-6">{why}</p>
              <p className="max-w-prose leading-6 text-muted-foreground">Cost: {cost}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass mt-5 grid gap-3 p-6 md:p-8" aria-labelledby="how">
        <h2 id="how" className="text-xl">How it fits together</h2>
        <pre className="overflow-x-auto rounded-md bg-foreground/[0.05] p-4 shadow-[0_0_0_1px_hsl(var(--foreground)/0.1)_inset] font-mono text-[13px] leading-5" aria-label="Architecture diagram" translate="no">{`password ──PBKDF2 ${DEFAULT_PBKDF2_ITERATIONS.toLocaleString("en-US")}×──► key-wrapping key ──┐
recovery key ─────HKDF────────► key-wrapping key ──┼─► unwraps ─► vault key (256-bit, random)
                                                    │                    │
IndexedDB:  [ wrapped keys ] [ AES-256-GCM ciphertext of the SQLite file ] │
                                                                          ▼
                         in memory while unlocked:  SQLite (WebAssembly) ◄─ decrypt
                                                            │
                                  repositories (validated, parameterised SQL)
                                                            │
                                                     React interface`}</pre>
        <ul className="grid gap-1.5">
          {STACK.map(([name, role]) => (
            <li key={name} className="flex flex-wrap gap-x-3"><span className="font-medium">{name}</span><span className="text-muted-foreground">{role}</span></li>
          ))}
        </ul>
      </section>

      <section className="glass mt-5 grid gap-3 p-6 md:p-8" aria-labelledby="limits">
        <h2 id="limits" className="text-xl">What it does not do</h2>
        <p className="max-w-prose leading-6">It does not defend against malware on your device or a compromised host, it does not sync, and it has not been independently audited. These are listed in full on the <Link className="text-primary underline underline-offset-2" to="/security">security page</Link>. Saying so is part of the design.</p>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="try">
        <h2 id="try" className="text-xl">See it working</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link to="/demo">Open the demo vault</Link></Button>
          <Button asChild variant="outline"><a href={SITE.repoUrl} rel="noopener noreferrer">Read the source</a></Button>
          {SITE.agency ? <Button asChild variant="outline"><a href={SITE.agency.url} rel="noopener noreferrer">Start a project with {SITE.agency.name}</a></Button> : null}
        </div>
      </section>
    </article>
  );
}
