import type { Budget, Transaction } from "@/db/repo";
import { type DateRange, type DateString, addMonths, inRange, monthRange, parseDate, shortMonth, todayLocal, weekRange, yearRange } from "./dates";

export interface MonthPoint {
  /** "YYYY-MM" */
  key: string;
  label: string;
  incomeMinor: number;
  expenseMinor: number;
}

export interface Stats {
  balanceMinor: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  monthSavedMinor: number;
  /** null when there was no income this month (a rate would be meaningless). */
  savingsRatePct: number | null;
  prevMonthExpenseMinor: number;
  /** null when last month had no spending to compare against. */
  expenseChangePct: number | null;
  /** This month's expenses keyed by category id. */
  expenseByCategory: Map<number, number>;
  /** Last six calendar months, oldest first, always six points. */
  trend: MonthPoint[];
}

export function computeStats(transactions: readonly Transaction[], today: DateString = todayLocal()): Stats {
  const now = parseDate(today);
  const thisMonth = monthRange(now);
  const prevMonth = monthRange(addMonths(now, -1));

  let totalIncomeMinor = 0;
  let totalExpenseMinor = 0;
  let monthIncomeMinor = 0;
  let monthExpenseMinor = 0;
  let prevMonthExpenseMinor = 0;
  const expenseByCategory = new Map<number, number>();

  const trendMonths = Array.from({ length: 6 }, (_, i) => addMonths(now, i - 5));
  const trend: MonthPoint[] = trendMonths.map((d) => ({
    key: monthRange(d).from.slice(0, 7),
    label: shortMonth(d),
    incomeMinor: 0,
    expenseMinor: 0,
  }));
  const trendIndex = new Map(trend.map((p, i) => [p.key, i]));

  for (const t of transactions) {
    const isIncome = t.kind === "income";
    if (isIncome) totalIncomeMinor += t.amountMinor;
    else totalExpenseMinor += t.amountMinor;

    if (inRange(t.occurredOn, thisMonth)) {
      if (isIncome) monthIncomeMinor += t.amountMinor;
      else {
        monthExpenseMinor += t.amountMinor;
        expenseByCategory.set(t.categoryId, (expenseByCategory.get(t.categoryId) ?? 0) + t.amountMinor);
      }
    } else if (!isIncome && inRange(t.occurredOn, prevMonth)) {
      prevMonthExpenseMinor += t.amountMinor;
    }

    const slot = trendIndex.get(t.occurredOn.slice(0, 7));
    if (slot !== undefined) {
      if (isIncome) trend[slot].incomeMinor += t.amountMinor;
      else trend[slot].expenseMinor += t.amountMinor;
    }
  }

  const monthSavedMinor = monthIncomeMinor - monthExpenseMinor;
  return {
    balanceMinor: totalIncomeMinor - totalExpenseMinor,
    totalIncomeMinor,
    totalExpenseMinor,
    monthIncomeMinor,
    monthExpenseMinor,
    monthSavedMinor,
    savingsRatePct: monthIncomeMinor > 0 ? (monthSavedMinor / monthIncomeMinor) * 100 : null,
    prevMonthExpenseMinor,
    expenseChangePct: prevMonthExpenseMinor > 0 ? ((monthExpenseMinor - prevMonthExpenseMinor) / prevMonthExpenseMinor) * 100 : null,
    expenseByCategory,
    trend,
  };
}

export function periodRange(period: Budget["period"], today: DateString = todayLocal()): DateRange {
  const now = parseDate(today);
  if (period === "weekly") return weekRange(now);
  if (period === "yearly") return yearRange(now);
  return monthRange(now);
}

export type BudgetStatus = "ok" | "near" | "over";

export interface BudgetProgress {
  budget: Budget;
  range: DateRange;
  spentMinor: number;
  remainingMinor: number;
  /** Unclamped percentage (can exceed 100). */
  pct: number;
  status: BudgetStatus;
}

/** Spend counts only expenses in the budget's category that fall inside the budget's CURRENT period. */
export function budgetProgress(budget: Budget, transactions: readonly Transaction[], today: DateString = todayLocal()): BudgetProgress {
  const range = periodRange(budget.period, today);
  let spentMinor = 0;
  for (const t of transactions) {
    if (t.kind === "expense" && t.categoryId === budget.categoryId && inRange(t.occurredOn, range)) spentMinor += t.amountMinor;
  }
  const pct = (spentMinor / budget.amountMinor) * 100;
  return {
    budget,
    range,
    spentMinor,
    remainingMinor: budget.amountMinor - spentMinor,
    pct,
    status: pct >= 100 ? "over" : pct >= 80 ? "near" : "ok",
  };
}
