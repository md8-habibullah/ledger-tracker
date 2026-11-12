import type { Transaction } from "@/db/repo";
import { type DateRange, type DateString, inRange, longMonth, monthRange, shortMonth, toDateString } from "./dates";
import type { MonthPoint } from "./stats";

/**
 * The span of time the Overview is looking at: a quick range, or one calendar month.
 * Everything here works in whole calendar months and local "YYYY-MM-DD" strings, like the rest of the date code.
 */
export type PeriodPreset = "this-month" | "last-month" | "last-3" | "last-6";
/** A preset, or one month as "YYYY-MM". This is what the page URL carries (`?period=`). */
export type PeriodId = PeriodPreset | `${number}-${number}`;

export const PERIOD_PRESETS: readonly { id: PeriodPreset; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-3", label: "Last 3 months" },
  { id: "last-6", label: "Last 6 months" },
];

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const FIRST_YEAR = 1900;

/** "2026-11" shifted by whole months ("2026-11", -11 is "2025-12"). */
export function shiftMonthKey(key: string, delta: number): string {
  return toDateString(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1)).slice(0, 7);
}

const monthStart = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
const rangeOfMonth = (key: string): DateRange => monthRange(monthStart(key));

/** A month that is this month or last month is the same thing as that preset: one name per period. */
function canonical(key: string, today: DateString): PeriodId {
  const current = today.slice(0, 7);
  if (key === current) return "this-month";
  if (key === shiftMonthKey(current, -1)) return "last-month";
  return key as PeriodId;
}

/** Reads a `?period=` value. Anything unknown or malformed falls back to this month. */
export function parsePeriod(value: string | null | undefined, today: DateString): PeriodId {
  if (value === "this-month" || value === "last-month" || value === "last-3" || value === "last-6") return value;
  const m = value ? MONTH_KEY.exec(value) : null;
  if (m && Number(m[1]) >= FIRST_YEAR) return canonical(value as string, today);
  return "this-month";
}

export interface ResolvedPeriod {
  id: PeriodId;
  /** "YYYY-MM", oldest first. */
  months: string[];
  /** Inclusive, whole months. */
  range: DateRange;
  /** The same number of whole months immediately before, for "up / down from" comparisons. */
  previous: DateRange;
  includesCurrentMonth: boolean;
  /** Page heading: "November so far", "October", "Last 3 months". */
  title: string;
  /** Button text: "This month", "Sep 2026". */
  label: string;
  /** For sentences: "this month", "over the last 3 months", "in October 2026". */
  when: string;
  /** What the comparison is against: "last month", "the month before", "the 3 months before". */
  previousFrom: string;
  /** "Sep – Nov 2026", "October 2026". */
  span: string;
}

export function resolvePeriod(value: string | null | undefined, today: DateString): ResolvedPeriod {
  const id = parsePeriod(value, today);
  const current = today.slice(0, 7);
  const count = id === "last-3" ? 3 : id === "last-6" ? 6 : 1;
  const last = id === "last-month" ? shiftMonthKey(current, -1) : id === "this-month" || id === "last-3" || id === "last-6" ? current : id;
  const months = Array.from({ length: count }, (_, i) => shiftMonthKey(last, i - count + 1));
  const first = months[0];

  const todayYear = today.slice(0, 4);
  const name = (key: string, withYear: boolean) => `${longMonth(monthStart(key))}${withYear ? ` ${key.slice(0, 4)}` : ""}`;
  const yearIfOther = (key: string) => key.slice(0, 4) !== todayYear;

  const common = {
    id,
    months,
    range: { from: rangeOfMonth(first).from, to: rangeOfMonth(last).to },
    previous: { from: rangeOfMonth(shiftMonthKey(first, -count)).from, to: rangeOfMonth(shiftMonthKey(last, -count)).to },
    includesCurrentMonth: months.includes(current),
  };

  if (id === "this-month") {
    return { ...common, title: `${name(current, false)} so far`, label: "This month", when: "this month", previousFrom: "last month", span: name(current, true) };
  }
  if (id === "last-month") {
    return { ...common, title: name(last, yearIfOther(last)), label: "Last month", when: "last month", previousFrom: "the month before", span: name(last, true) };
  }
  if (count > 1) {
    const lastYear = last.slice(0, 4);
    const firstPart = `${shortMonth(monthStart(first))}${first.slice(0, 4) === lastYear ? "" : ` ${first.slice(0, 4)}`}`;
    return {
      ...common,
      title: `Last ${count} months`,
      label: `Last ${count} months`,
      when: `over the last ${count} months`,
      previousFrom: `the ${count} months before`,
      span: `${firstPart} – ${shortMonth(monthStart(last))} ${lastYear}`,
    };
  }
  return {
    ...common,
    title: name(last, yearIfOther(last)),
    label: `${shortMonth(monthStart(last))} ${last.slice(0, 4)}`,
    when: `in ${name(last, true)}`,
    previousFrom: "the month before",
    span: name(last, true),
  };
}

export interface PeriodStats {
  incomeMinor: number;
  expenseMinor: number;
  savedMinor: number;
  /** null when there was no income in the period (a rate would be meaningless). */
  savingsRatePct: number | null;
  prevExpenseMinor: number;
  /** null when the previous span had no spending to compare against. */
  expenseChangePct: number | null;
  expenseByCategory: Map<number, number>;
  /** Expenses by category in the previous span, for the "up / down" notes. */
  previousByCategory: Map<number, number>;
  entryCount: number;
  /** Money in and out up to the end of the period (everything, when the period includes this month). */
  balanceMinor: number;
  /** The bars: the period's own months, or the six months ending with it when it is one month. Always at least two. */
  series: MonthPoint[];
  /** Six months ending with the period's last month, for the little trend lines. */
  trend: MonthPoint[];
}

export function computePeriodStats(transactions: readonly Transaction[], period: ResolvedPeriod): PeriodStats {
  const last = period.months[period.months.length - 1];
  const trendKeys = Array.from({ length: 6 }, (_, i) => shiftMonthKey(last, i - 5));
  const seriesKeys = period.months.length >= 2 ? period.months : trendKeys;
  const points = new Map<string, MonthPoint>();
  for (const key of [...trendKeys, ...seriesKeys]) {
    if (!points.has(key)) points.set(key, { key, label: shortMonth(monthStart(key)), incomeMinor: 0, expenseMinor: 0 });
  }

  let incomeMinor = 0;
  let expenseMinor = 0;
  let prevExpenseMinor = 0;
  let balanceMinor = 0;
  let entryCount = 0;
  const expenseByCategory = new Map<number, number>();
  const previousByCategory = new Map<number, number>();

  for (const t of transactions) {
    const isIncome = t.kind === "income";
    if (period.includesCurrentMonth || t.occurredOn <= period.range.to) balanceMinor += isIncome ? t.amountMinor : -t.amountMinor;

    if (inRange(t.occurredOn, period.range)) {
      entryCount += 1;
      if (isIncome) incomeMinor += t.amountMinor;
      else {
        expenseMinor += t.amountMinor;
        expenseByCategory.set(t.categoryId, (expenseByCategory.get(t.categoryId) ?? 0) + t.amountMinor);
      }
    } else if (!isIncome && inRange(t.occurredOn, period.previous)) {
      prevExpenseMinor += t.amountMinor;
      previousByCategory.set(t.categoryId, (previousByCategory.get(t.categoryId) ?? 0) + t.amountMinor);
    }

    const point = points.get(t.occurredOn.slice(0, 7));
    if (point) {
      if (isIncome) point.incomeMinor += t.amountMinor;
      else point.expenseMinor += t.amountMinor;
    }
  }

  const savedMinor = incomeMinor - expenseMinor;
  return {
    incomeMinor,
    expenseMinor,
    savedMinor,
    savingsRatePct: incomeMinor > 0 ? (savedMinor / incomeMinor) * 100 : null,
    prevExpenseMinor,
    expenseChangePct: prevExpenseMinor > 0 ? ((expenseMinor - prevExpenseMinor) / prevExpenseMinor) * 100 : null,
    expenseByCategory,
    previousByCategory,
    entryCount,
    balanceMinor,
    series: seriesKeys.map((k) => points.get(k) as MonthPoint),
    trend: trendKeys.map((k) => points.get(k) as MonthPoint),
  };
}

export interface LedgerMonths {
  /** Earliest and latest month that can be picked. Always includes this month. */
  min: string;
  max: string;
  /** Months that have at least one entry. */
  withEntries: Set<string>;
}

export function ledgerMonths(transactions: readonly Transaction[], today: DateString): LedgerMonths {
  const current = today.slice(0, 7);
  let min = current;
  let max = current;
  const withEntries = new Set<string>();
  for (const t of transactions) {
    const key = t.occurredOn.slice(0, 7);
    withEntries.add(key);
    if (key < min) min = key;
    if (key > max) max = key;
  }
  return { min, max, withEntries };
}
