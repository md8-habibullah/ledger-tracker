import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Glow } from "@/components/fx/Glow";
import { Button } from "@/components/ui/button";
import { CategoryChip, EmptyState, PageHeader, RuleSection } from "@/components/ledger/bits";
import { CashFlowChart, ProgressRule, RankedBars, Sparkline } from "@/components/ledger/charts";
import { useEntrySheet } from "@/components/ledger/EntrySheet";
import { Money } from "@/components/ledger/Money";
import { PeriodPicker } from "@/components/ledger/PeriodPicker";
import { QuickEntryBar } from "@/components/ledger/QuickEntryBar";
import { formatDayLabel, inRange, monthRange, parseDate } from "@/lib/dates";
import { computeInsights } from "@/lib/insights";
import { type PeriodId, computePeriodStats, ledgerMonths, resolvePeriod } from "@/lib/period";
import { budgetProgress } from "@/lib/stats";
import { useLedger } from "@/vault/useLedger";

function Figure({ label, children, note, spark, tone }: { label: string; children: React.ReactNode; note?: React.ReactNode; spark?: number[]; tone: "in" | "out" | "net" }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-4 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="row-span-2 flex items-center gap-4 justify-self-end">
        {spark ? <Sparkline values={spark} tone={tone} className="hidden sm:block" /> : null}
        <span className="text-xl">{children}</span>
      </dd>
      {note ? <dd className="text-sm text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

export default function Overview() {
  const ledger = useLedger();
  const { openNew, openEdit } = useEntrySheet();
  // The period lives in the URL (?period=last-3 or ?period=2026-09): it survives moving around and Back, and the Overview link resets it.
  const [params, setParams] = useSearchParams();
  const requested = params.get("period");

  const view = useMemo(() => {
    if (!ledger) return null;
    const period = resolvePeriod(requested, ledger.today);
    const stats = computePeriodStats(ledger.transactions, period);
    const now = parseDate(ledger.today);
    const ranked = [...stats.expenseByCategory]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, amountMinor]) => ({ category: ledger.categoryById.get(id), amountMinor, previousMinor: stats.previousByCategory.get(id) ?? 0 }));
    const budgets = ledger.budgets
      .map((b) => budgetProgress(b, ledger.transactions, ledger.today))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const lastDay = Number(monthRange(now).to.slice(8, 10));
    return {
      period,
      stats,
      months: ledgerMonths(ledger.transactions, ledger.today),
      ranked,
      budgets,
      daysLeft: lastDay - now.getDate(),
      insights: computeInsights(ledger.transactions, ledger.categoryById, ledger.currency, ledger.today),
      // This month keeps showing the latest entries overall; any other period lists its own latest entries.
      recent: (period.id === "this-month" ? ledger.transactions : ledger.transactions.filter((t) => inRange(t.occurredOn, period.range))).slice(0, 8),
    };
  }, [ledger, requested]);

  if (!ledger || !view) return null;
  const { period, stats } = view;
  const empty = ledger.transactions.length === 0;
  const thisMonth = period.id === "this-month";
  const setPeriod = (id: PeriodId) => setParams(id === "this-month" ? {} : { period: id }, { replace: true });
  // The heading already names any other period, so only "this month" keeps its tail (as it always read).
  const label = (base: string) => (thisMonth ? `${base} this month` : base);
  const entries = `${stats.entryCount} ${stats.entryCount === 1 ? "entry" : "entries"}`;

  return (
    <>
      <PageHeader
        title={period.title}
        description={
          thisMonth
            ? view.daysLeft === 0 ? "Last day of the month" : `${view.daysLeft} day${view.daysLeft === 1 ? "" : "s"} left in the month`
            : `${period.months.length > 1 ? `${period.span} · ` : ""}${entries}`
        }
        actions={empty ? undefined : <PeriodPicker value={period} months={view.months} today={ledger.today} onChange={setPeriod} />}
      />

      <QuickEntryBar />

      {empty ? (
        <EmptyState
          icon={Wallet}
          title="Your ledger is empty"
          action={<Button onClick={() => openNew()}>Add your first entry</Button>}
        >
          Record what you earn and spend. Everything stays encrypted on this device. Type a line like “tea 40” above, or press N for the full form.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="glass relative flex min-h-[15rem] flex-col justify-between overflow-hidden p-6 md:p-8" aria-label="Balance">
              <Glow className="-bottom-40 -right-32 h-[24rem] w-[24rem] opacity-50 md:opacity-70" />
              <div className="relative z-10">
                <p className="text-muted-foreground">Balance</p>
                <p className="mt-3 text-[clamp(2.25rem,5.4vw,3.75rem)] leading-none"><Money minor={stats.balanceMinor} animate className="glow-text" /></p>
              </div>
              <p className="relative z-10 mt-8 text-sm text-muted-foreground">
                {period.includesCurrentMonth ? "All entries, every month" : `Everything up to the end of ${period.span}`}
              </p>
            </section>
            <dl className="glass p-6">
              <Figure label={label("Money in")} tone="in" spark={stats.trend.map((p) => p.incomeMinor)}>
                <Money minor={stats.incomeMinor} kind="income" animate />
              </Figure>
              <div className="border-t border-foreground/[0.08]" />
              <Figure
                label={label("Money out")}
                tone="out"
                spark={stats.trend.map((p) => p.expenseMinor)}
                note={
                  stats.expenseChangePct === null
                    ? `No spending ${thisMonth ? "last month" : `in ${period.previousFrom}`} to compare`
                    : `${stats.expenseChangePct >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(stats.expenseChangePct))}% from ${period.previousFrom}`
                }
              >
                <Money minor={stats.expenseMinor} kind="expense" animate />
              </Figure>
              <div className="border-t border-foreground/[0.08]" />
              <Figure
                label={label(stats.savedMinor < 0 ? "Overspent" : "Kept")}
                tone="net"
                spark={stats.trend.map((p) => p.incomeMinor - p.expenseMinor)}
                note={stats.savingsRatePct === null ? (period.includesCurrentMonth ? "No income recorded yet" : "No income recorded") : `${Math.round(stats.savingsRatePct)}% of income`}
              >
                <Money minor={stats.savedMinor} animate />
              </Figure>
            </dl>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="grid content-start gap-5">
              <RuleSection title="Cash flow" description={period.months.length > 1 ? period.span : thisMonth ? "Last six months" : `Six months up to ${period.span}`}>
                <CashFlowChart data={stats.series} currency={ledger.currency} />
              </RuleSection>

              <RuleSection
                title={thisMonth ? "Recent entries" : "Latest in this period"}
                actions={<Link className="text-primary underline underline-offset-2" to="/app/entries">All entries</Link>}
              >
                {view.recent.length === 0 ? (
                  <p className="text-muted-foreground">No entries {period.when}.</p>
                ) : (
                  <ul className="-mx-2 divide-y divide-foreground/[0.07]">
                    {view.recent.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-3 text-left transition-colors duration-fast hover:bg-foreground/[0.06]"
                          aria-label={`Edit entry: ${t.note || "no note"}`}
                        >
                          <span className="text-muted-foreground">{formatDayLabel(t.occurredOn, ledger.today)}</span>
                          <span className="grid min-w-0">
                            <CategoryChip category={ledger.categoryById.get(t.categoryId)} />
                            {t.note ? <span className="truncate pl-7 text-sm text-muted-foreground">{t.note}</span> : null}
                          </span>
                          <Money minor={t.amountMinor} kind={t.kind} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </RuleSection>
            </div>

            <div className="grid content-start gap-5">
              <RuleSection title="Where it went" description={`Top spending ${period.when}`}>
                {view.ranked.length === 0 ? (
                  <p className="text-muted-foreground">No spending recorded {period.when}{period.includesCurrentMonth ? " yet" : ""}.</p>
                ) : (
                  <RankedBars rows={view.ranked} totalMinor={stats.expenseMinor} against={period.previousFrom} />
                )}
              </RuleSection>

              <RuleSection
                title="Budgets"
                description={thisMonth ? undefined : "Live, as of today"}
                actions={<Link className="text-primary underline underline-offset-2" to="/app/budgets">Manage</Link>}
              >
                {view.budgets.length === 0 ? (
                  <p className="text-muted-foreground">
                    No budgets yet. <Link className="text-primary underline underline-offset-2" to="/app/budgets">Set a limit</Link> for a category you want to watch.
                  </p>
                ) : (
                  <ul className="grid gap-4">
                    {view.budgets.map((p) => {
                      const category = ledger.categoryById.get(p.budget.categoryId);
                      return (
                        <li key={p.budget.id} className="grid gap-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate">{category?.name ?? "Unknown"} <span className="text-muted-foreground">· {p.budget.period}</span></span>
                            <span className="shrink-0 text-sm"><Money minor={p.spentMinor} compactWhole /> <span className="text-muted-foreground">of</span> <Money minor={p.budget.amountMinor} compactWhole /></span>
                          </div>
                          <ProgressRule pct={p.pct} status={p.status} label={`${category?.name ?? "Budget"} ${p.budget.period} budget`} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </RuleSection>

              {view.insights.length > 0 ? (
                <RuleSection title="Worth a look" description="Worked out on this device from your entries">
                  <ul className="grid gap-3">
                    {view.insights.map((i) => (
                      <li key={i.id} className="max-w-prose text-[0.9375rem] leading-6">{i.text}</li>
                    ))}
                  </ul>
                </RuleSection>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
