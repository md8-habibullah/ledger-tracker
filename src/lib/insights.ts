import type { Category, Transaction } from "@/db/repo";
import { type DateString, addMonths, inRange, monthRange, parseDate, todayLocal } from "./dates";
import { formatMoney } from "./money";

export interface Insight {
  id: string;
  /** Plain sentence, already formatted in the vault currency. */
  text: string;
}

/**
 * Up to three locally computed observations. Every sentence is derived from the numbers shown
 * elsewhere on the page — no guessing, no advice, and nothing is sent anywhere.
 */
export function computeInsights(
  transactions: readonly Transaction[],
  categoryById: Map<number, Category>,
  currency: string,
  today: DateString = todayLocal(),
): Insight[] {
  const now = parseDate(today);
  const thisMonth = monthRange(now);
  const prevMonth = monthRange(addMonths(now, -1));
  const sumBy = (range: { from: string; to: string }) => {
    const map = new Map<number, number>();
    for (const t of transactions) {
      if (t.kind === "expense" && inRange(t.occurredOn, range)) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountMinor);
    }
    return map;
  };
  const current = sumBy(thisMonth);
  const previous = sumBy(prevMonth);
  const out: Insight[] = [];
  const name = (id: number) => categoryById.get(id)?.name ?? "Uncategorised";

  // Largest meaningful rise versus last month (compare like with like: only the days elapsed so far).
  const elapsedRange = { from: prevMonth.from, to: toSameDay(prevMonth, now.getDate()) };
  const previousToDate = sumBy(elapsedRange);
  let risen: { id: number; pct: number; delta: number } | null = null;
  for (const [id, spent] of current) {
    const before = previousToDate.get(id) ?? 0;
    if (before > 0 && spent > before) {
      const delta = spent - before;
      const pct = (delta / before) * 100;
      if (pct >= 20 && (!risen || delta > risen.delta)) risen = { id, pct, delta };
    }
  }
  if (risen) {
    out.push({
      id: "category-up",
      text: `${name(risen.id)} is ${Math.round(risen.pct)}% higher than the same point last month (${formatMoney(risen.delta, { code: currency, compactWhole: true })} more).`,
    });
  }

  // Top category this month.
  const top = [...current].sort((a, b) => b[1] - a[1])[0];
  const monthTotal = [...current.values()].reduce((s, v) => s + v, 0);
  if (top && monthTotal > 0) {
    out.push({
      id: "top-category",
      text: `${name(top[0])} is your biggest expense this month: ${formatMoney(top[1], { code: currency, compactWhole: true })}, ${Math.round((top[1] / monthTotal) * 100)}% of spending.`,
    });
  }

  // Savings against income.
  let income = 0;
  let spent = 0;
  for (const t of transactions) {
    if (!inRange(t.occurredOn, thisMonth)) continue;
    if (t.kind === "income") income += t.amountMinor;
    else spent += t.amountMinor;
  }
  if (income > 0) {
    const saved = income - spent;
    out.push({
      id: "savings",
      text:
        saved >= 0
          ? `You have kept ${formatMoney(saved, { code: currency, compactWhole: true })} of this month's ${formatMoney(income, { code: currency, compactWhole: true })} income.`
          : `You have spent ${formatMoney(-saved, { code: currency, compactWhole: true })} more than this month's income so far.`,
    });
  }
  return out.slice(0, 3);
}

function toSameDay(range: { from: string; to: string }, day: number): string {
  const last = Number(range.to.slice(8, 10));
  return `${range.to.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
}
