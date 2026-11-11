import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntrySheetProvider, useEntrySheet } from "@/components/ledger/EntrySheet";
import { Kbd } from "@/components/ledger/bits";
import { LogoBadge } from "@/components/brand/LogoMark";
import { Seal } from "@/components/ledger/Seal";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { NAV, isTypingTarget, useGoShortcuts, useIsDesktop, useSidebarCollapsed, useSidebarSummary } from "./sidebarModel";
import { useAutoLockCountdown, useVault } from "@/vault/VaultProvider";
import { useLedger } from "@/vault/useLedger";

function Hotkeys() {
  const { openNew } = useEntrySheet();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        // Don't steal "n" while a dialog/sheet is open.
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);
  return null;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Vault status: the seal plus a live auto-lock countdown. */
function VaultStatus() {
  const { snapshot, autoLockMinutes } = useVault();
  const remaining = useAutoLockCountdown();
  const ledger = useLedger();

  if (snapshot.ephemeral) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Seal state="open" size={20} />
        <span>Demo vault · nothing is saved</span>
      </p>
    );
  }
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <Seal state="sealed" size={20} glow title="Encrypted on this device" />
      <span className="truncate font-medium">{ledger?.vaultName ?? "Vault"}</span>
      <span className="hidden whitespace-nowrap text-muted-foreground sm:inline" aria-live="off">
        {autoLockMinutes === "never" ? "· Auto-lock is off" : remaining !== null ? <>· Locks in <span className="figure">{formatCountdown(remaining)}</span></> : null}
      </span>
    </p>
  );
}

function Shell() {
  const { lock, snapshot } = useVault();
  const { openNew } = useEntrySheet();
  const desktop = useIsDesktop();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const armed = useGoShortcuts();
  const summary = useSidebarSummary();

  return (
    <div className={cn("min-h-dvh md:grid", collapsed ? "md:grid-cols-[5.25rem_minmax(0,1fr)]" : "md:grid-cols-[16.5rem_minmax(0,1fr)]")}>
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Hotkeys />

      {/* Floating dock (tablet and up). Not mounted on phones. */}
      {desktop ? <Sidebar summary={summary} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} armed={armed} /> : null}

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 px-4 pt-3 md:px-8">
          <div className="glass flex h-14 items-center justify-between gap-3 rounded-full pl-5 pr-2">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <LogoBadge size={32} />
              <span className="whitespace-nowrap font-display text-base font-semibold">Ledger Tracker</span>
            </div>
            <div className="hidden min-w-0 md:block">
              <VaultStatus />
            </div>
            <div className="flex items-center gap-1.5">
              <Button onClick={() => openNew()} className="gap-2 rounded-full pl-4 pr-5 max-sm:gap-0 max-sm:px-3.5">
                <Plus className="h-4 w-4" aria-hidden />
                <span className="max-sm:sr-only">New entry</span>
                <span className="hidden lg:inline [&_kbd]:bg-black/15 [&_kbd]:text-[hsl(var(--btn-fg))] [&_kbd]:shadow-none"><Kbd>N</Kbd></span>
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label={snapshot.ephemeral ? "Exit demo" : "Lock now"} onClick={() => void lock("manual")}>
                <Lock className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </header>

        {snapshot.ephemeral ? (
          <div role="note" className="no-print mx-4 mt-4 rounded-md bg-foreground/[0.05] px-4 py-2.5 text-sm shadow-[0_0_0_1px_hsl(var(--foil-4)/0.55)_inset] md:mx-8">
            You are looking at sample data in a demo vault. It exists only in this tab and disappears when you leave.{" "}
            <a className="font-medium text-primary underline underline-offset-2" href="/create">Create your own vault</a>
          </div>
        ) : null}

        <div className="px-4 pt-3 md:hidden"><VaultStatus /></div>

        <main id="main" className="min-w-0 flex-1 px-4 pb-32 pt-7 md:px-8 md:pb-14">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating bar (phones) */}
      <nav aria-label="Main" className="glass no-print pb-safe fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-full p-1.5 md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => {
          const alert = to === "/app/budgets" && summary && summary.alerts > 0 ? summary : null;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors",
                  isActive ? "bg-foreground/[0.1] font-medium text-foreground shadow-[0_0_0_1px_hsl(var(--foil-2)/0.4)_inset]" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              {alert ? (
                <>
                  <span aria-hidden className={cn("absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_hsl(var(--background))]", alert.worst === "over" ? "bg-destructive" : "bg-[hsl(var(--foil-4))]")} />
                  <span className="sr-only">, {alert.alerts} near or over the limit</span>
                </>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell() {
  return (
    <EntrySheetProvider>
      <Shell />
    </EntrySheetProvider>
  );
}
