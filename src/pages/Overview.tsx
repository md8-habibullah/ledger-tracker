import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Glow } from "@/components/fx/Glow";
import { Button } from "@/components/ui/button";
import { CategoryChip, EmptyState, PageHeader, RuleSection } from "@/components/ledger/bits";
import { CashFlowChart, ProgressRule, RankedBars, Sparkline } from "@/components/ledger/charts";
import { useEntrySheet } from "@/components/ledger/EntrySheet";
import { Money } from "@/components/ledger/Money";
import { QuickEntryBar } from "@/components/ledger/QuickEntryBar";
import { addMonths, formatDayLabel, inRange, monthRange, parseDate } from "@/lib/dates";
import { computeInsights } from "@/lib/insights";
import { budgetProgress } from "@/lib/stats";
import { useLedger } from "@/vault/useLedger";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  const view = useMemo(() => {
    if (!ledger) return null;
    const now = parseDate(ledger.today);
    const prev = monthRange(addMonths(now, -1));
    const previousByCategory = new Map<number, number>();
    for (const t of ledger.transactions) {
      if (t.kind === "expense" && inRange(t.occurredOn, prev)) previousByCategory.set(t.categoryId, (previousByCategory.get(t.categoryId) ?? 0) + t.amountMinor);
    }
    const ranked = [...ledger.stats.expenseByCategory]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, amountMinor]) => ({ category: ledger.categoryById.get(id), amountMinor, previousMinor: previousByCategory.get(id) ?? 0 }));
    const budgets = ledger.budgets
      .map((b) => budgetProgress(b, ledger.transactions, ledger.today))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const lastDay = Number(monthRange(now).to.slice(8, 10));
    return {
      now,
      ranked,
      budgets,
      daysLeft: lastDay - now.getDate(),
      insights: computeInsights(ledger.transactions, ledger.categoryById, ledger.currency, ledger.today),
      recent: ledger.transactions.slice(0, 8),
    };
  }, [ledger]);

  if (!ledger || !view) return null;
  const { stats } = ledger;
  const empty = ledger.transactions.length === 0;

  return (
    <>
      <PageHeader
        title={`${MONTH_NAMES[view.now.getMonth()]} so far`}
        description={view.daysLeft === 0 ? "Last day of the month" : `${view.daysLeft} day${view.daysLeft === 1 ? "" : "s"} left in the month`}
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
              <p className="relative z-10 mt-8 text-sm text-muted-foreground">All entries, every month</p>
            </section>
            <dl className="glass p-6">
              <Figure label="Money in this month" tone="in" spark={stats.trend.map((p) => p.incomeMinor)}>
                <Money minor={stats.monthIncomeMinor} kind="income" animate />
              </Figure>
              <div className="border-t border-foreground/[0.08]" />
              <Figure
                label="Money out this month"
                tone="out"
                spark={stats.trend.map((p) => p.expenseMinor)}
                note={
                  stats.expenseChangePct === null
                    ? "No spending last month to compare"
                    : `${stats.expenseChangePct >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(stats.expenseChangePct))}% from last month`
                }
              >
                <Money minor={stats.monthExpenseMinor} kind="expense" animate />
              </Figure>
              <div className="border-t border-foreground/[0.08]" />
              <Figure
                label={stats.monthSavedMinor < 0 ? "Overspent this month" : "Kept this month"}
                tone="net"
                spark={stats.trend.map((p) => p.incomeMinor - p.expenseMinor)}
                note={stats.savingsRatePct === null ? "No income recorded yet" : `${Math.round(stats.savingsRatePct)}% of income`}
              >
                <Money minor={stats.monthSavedMinor} animate />
              </Figure>
            </dl>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="grid content-start gap-5">
              <RuleSection title="Cash flow" description="Last six months">
                <CashFlowChart data={stats.trend} currency={ledger.currency} />
              </RuleSection>

              <RuleSection
                title="Recent entries"
                actions={<Link className="text-primary underline underline-offset-2" to="/app/entries">All entries</Link>}
              >
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
              </RuleSection>
            </div>

            <div className="grid content-start gap-5">
              <RuleSection title="Where it went" description="Top spending this month">
                {view.ranked.length === 0 ? (
                  <p className="text-muted-foreground">No spending recorded this month yet.</p>
                ) : (
                  <RankedBars rows={view.ranked} totalMinor={stats.monthExpenseMinor} />
                )}
              </RuleSection>

              <RuleSection
                title="Budgets"
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
