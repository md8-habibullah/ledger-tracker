import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "@/components/brand/LogoMark";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/security", label: "Security" },
  { to: "/case-study", label: "Case study" },
  { to: "/demo", label: "Open the demo" },
] as const;

const MICROPRINT = "Ledger Tracker · encrypted on this device · no account · no server · ";

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-3 z-40 px-3">
        <div className="glass mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 rounded-full pl-5 pr-2">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ledger Tracker home">
            <Logo size={34} />
            <span className="font-display text-lg font-semibold tracking-tight">Ledger Tracker</span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-1 text-sm">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn("hidden rounded-full px-3.5 py-2 transition-colors duration-fast hover:bg-foreground/[0.08] hover:text-foreground sm:block", isActive ? "bg-foreground/[0.08] font-medium text-foreground" : "text-muted-foreground")
                }
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/unlock" className="btn-primary ml-1 inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold">
              Unlock
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-10">
        <div className="microprint py-1.5" aria-hidden>
          {MICROPRINT.repeat(24)}
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-8 text-sm text-muted-foreground md:px-8">
          <p className="flex items-center gap-2.5">
            <Logo size={26} />
            Ledger Tracker runs in your browser. It has no server of its own and never sends your entries anywhere.
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <Link className="transition-colors hover:text-foreground" to="/security">Security and limits</Link>
            <Link className="transition-colors hover:text-foreground" to="/case-study">Case study</Link>
            <Link className="transition-colors hover:text-foreground sm:hidden" to="/demo">Open the demo</Link>
            <a className="transition-colors hover:text-foreground" href={SITE.repoUrl} rel="noopener noreferrer">Source code</a>
            {SITE.agency ? <a className="transition-colors hover:text-foreground" href={SITE.agency.url} rel="noopener noreferrer">Built by {SITE.agency.name}</a> : null}
          </p>
        </div>
      </footer>
    </div>
  );
}
