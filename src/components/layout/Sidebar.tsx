import { Link, NavLink } from "react-router-dom";
import { Lock, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/brand/LogoMark";
import { CategoryMark, Kbd } from "@/components/ledger/bits";
import { ProgressRule } from "@/components/ledger/charts";
import { Money } from "@/components/ledger/Money";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BudgetStatus } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { type ThemePreference, useTheme } from "@/theme/ThemeProvider";
import { useVault } from "@/vault/VaultProvider";
import { NAV, type NavItem, type SidebarSummary } from "./sidebarModel";

/* ------------------------------------------------------------------ nav links */

interface Badge {
  text: string;
  /** Read aloud after the label. */
  sr: string;
  tone: "count" | BudgetStatus;
}

function badgeFor(item: NavItem, summary: SidebarSummary | null): Badge | null {
  if (!summary) return null;
  if (item.to === "/app/entries" && summary.monthEntries > 0) {
    return { text: summary.monthEntries > 99 ? "99+" : String(summary.monthEntries), sr: `${summary.monthEntries} this month`, tone: "count" };
  }
  if (item.to === "/app/budgets" && summary.alerts > 0) {
    return { text: String(summary.alerts), sr: `${summary.alerts} near or over the limit`, tone: summary.worst };
  }
  return null;
}

const PILL_TONE: Record<Badge["tone"], string> = {
  count: "text-muted-foreground",
  ok: "text-muted-foreground",
  near: "bg-warn text-warn-foreground",
  over: "bg-destructive text-destructive-foreground",
};

function BadgePill({ badge }: { badge: Badge }) {
  const filled = badge.tone === "near" || badge.tone === "over";
  return (
    <span className={cn("figure inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs", filled ? "px-1.5 font-semibold" : "px-1", PILL_TONE[badge.tone])}>
      <span aria-hidden>{badge.text}</span>
      <span className="sr-only"> {badge.sr}</span>
    </span>
  );
}

function SidebarLink({ item, summary, collapsed }: { item: NavItem; summary: SidebarSummary | null; collapsed: boolean }) {
  const { to, label, icon: Icon, end, go } = item;
  const badge = badgeFor(item, summary);
  const active = (isActive: boolean) =>
    isActive
      ? "bg-foreground/[0.08] font-medium text-foreground shadow-[0_0_0_1px_hsl(var(--foil-2)/0.4)_inset]"
      : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground";

  if (collapsed) {
    const spoken = badge ? `${label}, ${badge.sr}` : label;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={to}
            end={end}
            aria-label={spoken}
            className={({ isActive }) => cn("group relative grid h-11 w-11 place-items-center rounded-md transition-[background-color,box-shadow,color] duration-fast", active(isActive))}
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} aria-hidden />
                {badge && (badge.tone === "near" || badge.tone === "over") ? (
                  <span
                    aria-hidden
                    className={cn("absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_hsl(var(--background))]", badge.tone === "over" ? "bg-destructive" : "bg-warn")}
                  />
                ) : null}
              </>
            )}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">{spoken}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn("group flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-[background-color,box-shadow,color] duration-fast [@media(max-height:760px)]:h-9", active(isActive))}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {/* The badge and the shortcut hint share one spot: the hint replaces the badge on hover or focus,
              and on every link while "g" is waiting for its letter. */}
          <span className="grid shrink-0 justify-items-end">
            {badge ? (
              <span className="col-start-1 row-start-1 transition-opacity duration-fast group-hover:opacity-0 group-focus-visible:opacity-0 group-data-[armed=true]/sb:opacity-0">
                <BadgePill badge={badge} />
              </span>
            ) : null}
            <span
              aria-hidden
              className="col-start-1 row-start-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[armed=true]/sb:opacity-100"
            >
              <Kbd>g</Kbd>
              <Kbd>{go}</Kbd>
            </span>
          </span>
        </>
      )}
    </NavLink>
  );
}

/* ------------------------------------------------------------------ cards */

/** Money in against money out for the month, with a 2 px gap between the fills. The words carry the meaning, not the colours. */
function FlowBar({ incomeMinor, expenseMinor }: { incomeMinor: number; expenseMinor: number }) {
  const total = incomeMinor + expenseMinor;
  const inPct = total === 0 ? 0 : Math.round((incomeMinor / total) * 100);
  return (
    <div
      role="img"
      aria-label={total === 0 ? "Nothing recorded this month" : `Of the money moved this month, ${inPct}% came in and ${100 - inPct}% went out`}
      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-foreground/[0.08]"
    >
      {total > 0 && inPct > 0 ? <span className="min-w-0 rounded-l-full" style={{ width: `${inPct}%`, background: "hsl(var(--chart-in))" }} /> : null}
      {total > 0 && inPct < 100 ? <span className="min-w-0 flex-1 rounded-r-full" style={{ background: "hsl(var(--chart-out))" }} /> : null}
    </div>
  );
}

function MonthCard({ summary }: { summary: SidebarSummary }) {
  const overspent = summary.keptMinor < 0;
  return (
    <section aria-label={`${summary.month} so far`} className="well grid grid-cols-[minmax(0,1fr)] gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{summary.month}</h2>
        <span className="text-xs text-muted-foreground">Day {summary.day} of {summary.lastDay}</span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{overspent ? "Overspent so far" : "Kept so far"}</p>
        <p className="mt-0.5 text-[1.375rem] leading-tight"><Money minor={summary.keptMinor} /></p>
      </div>
      <FlowBar incomeMinor={summary.incomeMinor} expenseMinor={summary.expenseMinor} />
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Money in</dt>
          <dd className="mt-0.5"><Money minor={summary.incomeMinor} kind="income" /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Money out</dt>
          <dd className="mt-0.5"><Money minor={summary.expenseMinor} kind="expense" /></dd>
        </div>
      </dl>
    </section>
  );
}

const PERIOD_SHORT = { weekly: "wk", monthly: "mo", yearly: "yr" } as const;
const PERIOD_WORD = { weekly: "weekly", monthly: "monthly", yearly: "yearly" } as const;

function BudgetWatch({ summary }: { summary: SidebarSummary }) {
  const rows = summary.budgets.slice(0, 3);
  return (
    <section aria-label="Budget watch" className="grid grid-cols-[minmax(0,1fr)] gap-3 px-1">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Budgets</h2>
        <Link to="/app/budgets" className="text-xs text-primary underline underline-offset-2">{rows.length === 0 ? "Set a limit" : "Manage"}</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">No budgets yet. A limit on a category shows its progress here, on every page.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {rows.map((p) => {
            const name = p.category?.name ?? "Unknown";
            const period = PERIOD_WORD[p.budget.period];
            const over = p.status === "over";
            return (
              <li key={p.budget.id} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <CategoryMark category={p.category} size={18} />
                  <span className="min-w-0 flex-1 truncate" title={`${name}, ${period}`}>{name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{PERIOD_SHORT[p.budget.period]}</span>
                  <span className={cn("figure inline-flex shrink-0 items-center gap-1 text-xs", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {over ? <TriangleAlert className="h-3 w-3" aria-hidden /> : null}
                    {Math.round(p.pct)}%
                    {over ? <span className="sr-only"> over the limit</span> : null}
                  </span>
                </div>
                <ProgressRule compact pct={p.pct} status={p.status} label={`${name} ${period} budget`} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ footer controls */

const THEMES: readonly { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match my device", icon: Monitor },
  { value: "paper", label: "Pearl (light)", icon: Sun },
  { value: "vault", label: "Vault (dark)", icon: Moon },
];

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-full bg-foreground/[0.06] p-1">
      {THEMES.map(({ value, label, icon: Icon }) => {
        const on = preference === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={on}
                aria-label={label}
                onClick={() => setPreference(value)}
                className={cn(
                  "grid h-8 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-fast",
                  on ? "bg-foreground/[0.12] text-foreground shadow-[0_0_0_1px_hsl(var(--foil-2)/0.4)_inset]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Rail version: one button that steps through the three choices. */
function ThemeCycle() {
  const { preference, setPreference } = useTheme();
  const index = THEMES.findIndex((t) => t.value === preference);
  const current = THEMES[index < 0 ? 0 : index];
  const next = THEMES[(index + 1) % THEMES.length];
  const Icon = current.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-md" aria-label={`Theme: ${current.label}. Switch to ${next.label}`} onClick={() => setPreference(next.value)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Theme: {current.label}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ the sidebar */

export function Sidebar({ summary, collapsed, onToggle, armed }: { summary: SidebarSummary | null; collapsed: boolean; onToggle: () => void; armed: boolean }) {
  const { lock, snapshot } = useVault();
  const lockLabel = snapshot.ephemeral ? "Exit demo" : "Lock now";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  const toggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" aria-label={toggleLabel} aria-expanded={!collapsed} onClick={onToggle}>
          <ToggleIcon className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={collapsed ? "right" : "bottom"}>{toggleLabel}</TooltipContent>
    </Tooltip>
  );

  return (
    <aside aria-label="Sidebar" className="group/sb no-print p-4 pr-0" data-armed={armed}>
      <div className={cn("glass sticky top-4 flex h-[calc(100dvh-2rem)] flex-col py-5 [@media(max-height:760px)]:py-3", collapsed ? "items-center px-2" : "px-3")}>
        {collapsed ? (
          <div className="grid justify-items-center gap-3">
            <Logo size={38} />
            {toggle}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pl-3 pr-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={38} />
              <span className="truncate font-display text-xl font-semibold tracking-tight">Ledger Tracker</span>
            </div>
            {toggle}
          </div>
        )}

        <nav aria-label="Main" className={cn("grid gap-1", collapsed ? "mt-7" : "mt-8 [@media(max-height:760px)]:mt-4")}>
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} summary={summary} collapsed={collapsed} />
          ))}
        </nav>

        {collapsed ? (
          <div className="mt-auto grid justify-items-center gap-1">
            <ThemeCycle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-md" aria-label={lockLabel} onClick={() => void lock("manual")}>
                  <Lock className="h-[18px] w-[18px]" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{lockLabel}</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            {/* The cards scroll on short screens; the links above and the controls below stay put. */}
            <div className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain px-1 pb-1 [scrollbar-width:thin] [@media(max-height:760px)]:mt-3">
              {summary ? (
                <>
                  <MonthCard summary={summary} />
                  <BudgetWatch summary={summary} />
                </>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 border-t border-foreground/[0.08] px-1 pt-3">
              <ThemeSwitch />
              <Button variant="outline" className="justify-start gap-2" onClick={() => void lock("manual")}>
                <Lock className="h-4 w-4" aria-hidden />
                {lockLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
