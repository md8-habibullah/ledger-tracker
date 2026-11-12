import { Link } from "react-router-dom";
import { Code2, Database, Download, LockKeyhole, Network, ServerOff, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Glow } from "@/components/fx/Glow";
import { ProveIt } from "@/components/landing/ProveIt";
import { HeroCards } from "@/components/landing/HeroCards";
import { Kbd } from "@/components/ledger/bits";
import { DEFAULT_PBKDF2_ITERATIONS } from "@/crypto/envelope";
import { formatMoney } from "@/lib/money";

const CHECKS = [
  {
    icon: Network,
    title: "Your entries never travel",
    steps: "Open your browser's developer tools and go to the Network tab. Add an entry. You will see no request that carries it.",
  },
  {
    icon: Database,
    title: "What is stored is unreadable",
    steps: "In developer tools open Application, then IndexedDB, then ledger-tracker, then vaults. The vault is a block of encoded ciphertext. Your category names and notes do not appear in it.",
  },
  {
    icon: LockKeyhole,
    title: "Locked means gone from memory",
    steps: "Press Lock now. The page reloads, which discards the decrypted data held by this tab. Nothing about your session is saved, so closing the tab also locks the vault.",
  },
];

const LIMITS = [
  "If you forget your password and lose your recovery key, nobody can recover your data. There is no server and no reset email.",
  `Anyone who copies your stored data can try passwords offline. The password is stretched with ${DEFAULT_PBKDF2_ITERATIONS.toLocaleString("en-US")} rounds, which slows guessing but cannot save a weak password.`,
  "Software on your device that can read the page while the vault is open, such as malware or a hostile browser extension, can read your data. Encryption protects data at rest, not an unlocked screen.",
  "The code that does the encryption is delivered by the website you load it from. That is why the source is open and why you can build and host it yourself.",
  "The vault's name, its size and when it was last saved are visible without the password.",
  "There is no sync between devices, and a browser can clear site data. Download a backup file now and then.",
  "It has not had an independent security audit.",
];

const FAQ = [
  ["Where is my data?", "In this browser, in IndexedDB, as ciphertext. Nothing is uploaded. There is no account."],
  ["What if I forget my password?", "Use your recovery key to set a new password. If you have neither, the data cannot be opened by anyone, including us. You can erase the vault and start again."],
  ["Can I use it on my phone and my laptop?", "Yes, but they are separate. Each device has its own vault. Move data between them with an encrypted backup file."],
  ["Does it work without internet?", "After the page has loaded, entering and viewing data does not need a connection. Opening the site fresh while offline does not work yet."],
  ["What does it cost?", "Nothing. It is open source under the MIT licence."],
  ["I used an earlier version. What happens to my data?", "The earlier version stored data without encryption. On first visit you are offered a one-time encryption of that data, checked against the original, and then you choose when to delete the old copy."],
];

const TRUST = [
  { icon: ShieldCheck, text: "AES-256-GCM encryption" },
  { icon: ServerOff, text: "No account, no server" },
  { icon: Code2, text: "Open source, MIT" },
];

const SAMPLE_CATEGORIES = [
  ["Food", "--foil-4"],
  ["Transport", "--foil-2"],
  ["Rent", "--foil-5"],
  ["Salary", "--foil-1"],
  ["Coffee", "--foil-3"],
  ["Gifts", "--foil-6"],
] as const;

function SectionHead({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.02] tracking-[-0.03em]">{title}</h2>
      {children ? <p className="mt-4 text-base leading-7 text-muted-foreground">{children}</p> : null}
    </div>
  );
}

function Tile({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <li className={`glass flex flex-col gap-4 p-6 ${className ?? ""}`}>
      <div>
        <h3 className="text-xl">{title}</h3>
      </div>
      {children}
    </li>
  );
}

export default function Landing() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-6">
        <div className="relative z-10 flex flex-col items-start gap-7">
          <h1 className="animate-rise text-[clamp(2.7rem,6.9vw,5.4rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            Your money ledger, locked on your own device.
          </h1>
          <p className="animate-rise max-w-xl text-lg leading-8 text-muted-foreground" style={{ animationDelay: "120ms" }}>
            Track income, expenses and budgets in taka. Everything is encrypted with your password and kept in this browser. There is no account and no server holding your numbers.
          </p>
          <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
            <Button asChild size="lg"><Link to="/demo">Open the demo vault</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/create">Create your vault</Link></Button>
          </div>
          <ul className="animate-rise flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" style={{ animationDelay: "320ms" }}>
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden />{text}</li>
            ))}
          </ul>
          <p className="animate-rise text-sm text-muted-foreground" style={{ animationDelay: "380ms" }}>The demo uses sample data and saves nothing. Free and open source.</p>
        </div>
        <HeroCards className="animate-rise" />
      </section>

      {/* ------------------------------------------------------------ proof */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="proof-title">
        <SectionHead id="proof-title" title="Watch it prove itself.">
          The panel below runs in this tab, right now. It runs the app's real encryption on text you type.
        </SectionHead>
        <ProveIt className="mt-10" />
      </section>

      {/* ------------------------------------------------------------ check it yourself */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="verify-title">
        <SectionHead id="verify-title" title="Check it yourself.">Each claim here can be tested in a minute with tools already in your browser.</SectionHead>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {CHECKS.map(({ icon: Icon, title, steps }) => (
            <li key={title} className="glass flex flex-col gap-4 p-6">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-foreground/[0.06] text-primary shadow-[0_0_0_1px_hsl(var(--foil-2)/0.4)_inset]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-xl">{title}</h3>
              <p className="leading-7 text-muted-foreground">{steps}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ what it does */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="features-title">
        <SectionHead id="features-title" title="Built for taka, built to stay out of the way." />
        <ul className="mt-10 grid gap-5 md:grid-cols-6">
          <Tile title="Record in one line" className="md:col-span-3">
            <p className="text-muted-foreground">Type “tea 40” or “+85000 salary 1 nov”. It is understood on your device and saved when you press Enter.</p>
            <div className="well mt-auto grid gap-3 p-4" aria-hidden>
              <p className="flex items-center gap-2 font-mono text-sm"><span className="text-primary">›</span>+85000 salary 1 nov<span className="h-4 w-px animate-pulse bg-primary" /></p>
              <p className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-3 text-sm">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-foil-1" />Salary <span className="text-muted-foreground">· 1 Nov</span></span>
                <span className="figure">{formatMoney(8500000, { code: "BDT" })}</span>
              </p>
            </div>
          </Tile>
          <Tile title="Budgets that mean what they say" className="md:col-span-3">
            <p className="text-muted-foreground">Weekly, monthly and yearly limits. Each one counts only spending inside its own current period.</p>
            <div className="well mt-auto flex items-center gap-5 p-4" aria-hidden>
              <svg viewBox="0 0 44 44" className="h-16 w-16 shrink-0 -rotate-90">
                <defs>
                  <linearGradient id="budget-demo" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: "hsl(var(--foil-1))" }} />
                    <stop offset="1" style={{ stopColor: "hsl(var(--foil-3))" }} />
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-foreground/10" />
                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" stroke="url(#budget-demo)" pathLength={100} strokeDasharray="72 100" />
              </svg>
              <p className="text-sm"><span className="figure text-2xl">72%</span><br /><span className="text-muted-foreground">Groceries, monthly · within the limit</span></p>
            </div>
          </Tile>
          <Tile title="Your categories" className="md:col-span-2">
            <p className="text-muted-foreground">Rename, recolour, merge or archive them. Old entries follow the change.</p>
            <div className="mt-auto flex flex-wrap gap-2" aria-hidden>
              {SAMPLE_CATEGORIES.map(([name, token]) => (
                <span key={name} className="well inline-flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(var(${token}))` }} />{name}
                </span>
              ))}
            </div>
          </Tile>
          <Tile title="Taka first" className="md:col-span-2">
            <p className="text-muted-foreground">Lakh and crore grouping, true minus signs, and amounts kept as whole paisa so totals are exact.</p>
            <p className="figure glow-text mt-auto text-[1.7rem] leading-none" aria-hidden>{formatMoney(124500000, { code: "BDT" })}</p>
          </Tile>
          <Tile title="Backups you control" className="md:col-span-2">
            <p className="text-muted-foreground">Download an encrypted file and restore it anywhere. Export a spreadsheet when you need one.</p>
            <span className="well mt-auto inline-flex w-fit items-center gap-2 px-3 py-2 text-sm" aria-hidden><Download className="h-4 w-4 text-primary" />ledger-tracker-vault.json</span>
          </Tile>
          <Tile title="Dark and light" className="md:col-span-6">
            <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <p className="max-w-2xl text-muted-foreground">Vault (dark) and Pearl (light) themes, a compact row density, and the <Kbd>N</Kbd> key for a new entry from anywhere.</p>
              <div className="flex gap-3" aria-hidden>
                <span className="grid h-14 w-24 place-items-center rounded-md text-xs font-medium text-[#EFF1F5] shadow-[0_0_0_1px_hsl(0_0%_100%/0.14)_inset]" style={{ background: "linear-gradient(135deg,#101316,#1D2227)" }}>Vault</span>
                <span className="grid h-14 w-24 place-items-center rounded-md text-xs font-medium text-[#111622] shadow-[0_0_0_1px_hsl(224_20%_20%/0.18)_inset]" style={{ background: "linear-gradient(135deg,#FFFFFF,#E7EAF1)" }}>Pearl</span>
              </div>
            </div>
          </Tile>
        </ul>
      </section>

      {/* ------------------------------------------------------------ limits */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="limits-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <SectionHead id="limits-title" title="What it does not protect against.">
            Trust is easier when the limits are written down. The longer version is on the <Link className="text-primary underline underline-offset-2" to="/security">security page</Link>.
          </SectionHead>
          <ul className="grid gap-3">
            {LIMITS.map((l) => (
              <li key={l} className="well border-l-2 border-foil-4 px-5 py-4 leading-7" style={{ borderRadius: "var(--radius)" }}>{l}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="faq-title">
        <SectionHead id="faq-title" title="Questions." />
        <div className="glass mt-8 px-6 md:px-8">
          <Accordion type="single" collapsible>
            {FAQ.map(([q, a], i) => (
              <AccordionItem key={q} value={`q${i}`} className="last:border-b-0">
                <AccordionTrigger className="text-left text-base font-medium">{q}</AccordionTrigger>
                <AccordionContent className="max-w-prose text-[0.9375rem] leading-7 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ------------------------------------------------------------ closing call */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-12 md:px-8" aria-labelledby="cta-title">
        <div className="glass relative overflow-hidden p-8 md:p-14">
          <Glow className="-right-24 -top-28 h-[26rem] w-[26rem] opacity-70 md:-right-12" />
          <div className="relative z-10 max-w-xl">
            <h2 id="cta-title" className="text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.03em]">See it with sample data.</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">The demo vault holds six months of sample entries in memory. Nothing is saved, and it disappears when you leave.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/demo">Open the demo vault</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/create">Create your vault</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
