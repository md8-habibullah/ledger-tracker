import type { Budget, Category, Transaction } from "@/db/repo";
import { type DateString, inRange, longMonth, monthRange, parseDate } from "./dates";
import { type BudgetProgress, type BudgetStatus, type Stats, budgetProgress } from "./stats";

export interface WatchedBudget extends BudgetProgress {
  category?: Category;
}

export interface SidebarSummary {
  /** "November" */
  month: string;
  /** Day of the month, 1-based. */
  day: number;
  lastDay: number;
  /** Entries dated in the current month. */
  monthEntries: number;
  keptMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  /** Every budget, closest to its limit first. */
  budgets: WatchedBudget[];
  /** Budgets at 80% or more of their limit (near or over). */
  alerts: number;
  /** The most serious state among the budgets: over, else near, else ok. */
  worst: BudgetStatus;
}

export interface SidebarSummaryInput {
  transactions: readonly Transaction[];
  budgets: readonly Budget[];
  categoryById: ReadonlyMap<number, Category>;
  stats: Pick<Stats, "monthSavedMinor" | "monthIncomeMinor" | "monthExpenseMinor">;
  today: DateString;
}

/** What the sidebar shows beyond its links, worked out from the open vault (pure, so it is tested without a DOM). */
export function buildSidebarSummary({ transactions, budgets, categoryById, stats, today }: SidebarSummaryInput): SidebarSummary {
  const now = parseDate(today);
  const range = monthRange(now);
  let monthEntries = 0;
  for (const t of transactions) if (inRange(t.occurredOn, range)) monthEntries++;

  const watched: WatchedBudget[] = budgets
    .map((b) => ({ ...budgetProgress(b, transactions, today), category: categoryById.get(b.categoryId) }))
    // Closest to the limit first; ties keep a stable order by id.
    .sort((a, b) => b.pct - a.pct || a.budget.id - b.budget.id);
  const alerts = watched.filter((b) => b.status !== "ok").length;

  return {
    month: longMonth(now),
    day: now.getDate(),
    lastDay: Number(range.to.slice(8, 10)),
    monthEntries,
    keptMinor: stats.monthSavedMinor,
    incomeMinor: stats.monthIncomeMinor,
    expenseMinor: stats.monthExpenseMinor,
    budgets: watched,
    alerts,
    worst: watched.some((b) => b.status === "over") ? "over" : alerts > 0 ? "near" : "ok",
  };
}
