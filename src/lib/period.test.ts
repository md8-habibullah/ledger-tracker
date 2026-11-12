import { describe, expect, it } from "vitest";
import type { Transaction } from "@/db/repo";
import { computePeriodStats, ledgerMonths, parsePeriod, resolvePeriod, shiftMonthKey } from "./period";
import { computeStats } from "./stats";

const TODAY = "2026-11-12";

let nextId = 1;
const tx = (over: Partial<Transaction> & Pick<Transaction, "amountMinor" | "occurredOn">): Transaction => ({
  id: nextId++,
  kind: "expense",
  categoryId: 1,
  note: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const income = (amountMinor: number, occurredOn: string) => tx({ kind: "income", categoryId: 9, amountMinor, occurredOn });
const stats = (transactions: Transaction[], period: string | null, today = TODAY) => computePeriodStats(transactions, resolvePeriod(period, today));

describe("shiftMonthKey", () => {
  it("moves across year ends and by more than a year", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-11", -11)).toBe("2025-12");
    expect(shiftMonthKey("2026-11", 0)).toBe("2026-11");
    expect(shiftMonthKey("2026-03", -14)).toBe("2025-01");
  });
});

describe("parsePeriod", () => {
  it("passes the presets through", () => {
    for (const id of ["this-month", "last-month", "last-3", "last-6"]) expect(parsePeriod(id, TODAY)).toBe(id);
  });

  it("accepts a specific month", () => {
    expect(parsePeriod("2026-09", TODAY)).toBe("2026-09");
    expect(parsePeriod("2024-02", TODAY)).toBe("2024-02");
  });

  it("names this month and last month by their presets, so there is one name per period", () => {
    expect(parsePeriod("2026-11", TODAY)).toBe("this-month");
    expect(parsePeriod("2026-10", TODAY)).toBe("last-month");
    expect(parsePeriod("2025-12", "2026-01-05")).toBe("last-month");
  });

  it("falls back to this month for anything unknown or malformed", () => {
    for (const bad of [null, undefined, "", "garbage", "2026-13", "2026-00", "2026-9", "26-09", "2026-09-01", "1850-01", "last-12", "LAST-3", " last-3"]) {
      expect(parsePeriod(bad, TODAY)).toBe("this-month");
    }
  });
});

describe("resolvePeriod", () => {
  it("this month: the whole calendar month, compared with last month", () => {
    const p = resolvePeriod("this-month", TODAY);
    expect(p).toMatchObject({
      id: "this-month",
      months: ["2026-11"],
      range: { from: "2026-11-01", to: "2026-11-30" },
      previous: { from: "2026-10-01", to: "2026-10-31" },
      includesCurrentMonth: true,
      title: "November so far",
      label: "This month",
      when: "this month",
      previousFrom: "last month",
    });
  });

  it("last month, including across a year end", () => {
    const p = resolvePeriod("last-month", "2027-01-15");
    expect(p).toMatchObject({
      months: ["2026-12"],
      range: { from: "2026-12-01", to: "2026-12-31" },
      previous: { from: "2026-11-01", to: "2026-11-30" },
      includesCurrentMonth: false,
      title: "December 2026", // a different year from today, so the year is spelled out
      previousFrom: "the month before",
    });
  });

  it("last 3 months: this month and the two before it, compared with the three before those", () => {
    const p = resolvePeriod("last-3", TODAY);
    expect(p.months).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(p.range).toEqual({ from: "2026-09-01", to: "2026-11-30" });
    expect(p.previous).toEqual({ from: "2026-06-01", to: "2026-08-31" });
    expect(p).toMatchObject({ includesCurrentMonth: true, title: "Last 3 months", label: "Last 3 months", span: "Sep – Nov 2026", when: "over the last 3 months", previousFrom: "the 3 months before" });
  });

  it("last 3 months over a year end, from the 31st (no day-of-month clamping surprises)", () => {
    const p = resolvePeriod("last-3", "2027-01-31");
    expect(p.months).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(p.range).toEqual({ from: "2026-11-01", to: "2027-01-31" });
    expect(p.previous).toEqual({ from: "2026-08-01", to: "2026-10-31" });
    expect(p.span).toBe("Nov 2026 – Jan 2027");
  });

  it("last 6 months", () => {
    const p = resolvePeriod("last-6", TODAY);
    expect(p.months).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(p.range).toEqual({ from: "2026-06-01", to: "2026-11-30" });
    expect(p.previous).toEqual({ from: "2025-12-01", to: "2026-05-31" });
  });

  it("copes with leap years and 31-day months", () => {
    expect(resolvePeriod("last-month", "2028-03-31").range).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(resolvePeriod("last-month", "2026-03-31").range).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolvePeriod("2026-01", "2026-03-31").previous).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("a specific month", () => {
    const p = resolvePeriod("2026-02", TODAY);
    expect(p).toMatchObject({
      id: "2026-02",
      months: ["2026-02"],
      range: { from: "2026-02-01", to: "2026-02-28" },
      previous: { from: "2026-01-01", to: "2026-01-31" },
      includesCurrentMonth: false,
      title: "February",
      label: "Feb 2026",
      when: "in February 2026",
      span: "February 2026",
    });
    expect(resolvePeriod("2025-12", TODAY).title).toBe("December 2025");
  });

  it("a month picked from the calendar that is this month resolves to the preset", () => {
    expect(resolvePeriod("2026-11", TODAY).id).toBe("this-month");
    expect(resolvePeriod("2026-10", TODAY).id).toBe("last-month");
  });

  it("an unreadable value resolves to this month", () => {
    expect(resolvePeriod("nonsense", TODAY).id).toBe("this-month");
  });
});

describe("computePeriodStats", () => {
  const ledger = () => [
    income(5000000, "2026-06-01"),
    tx({ categoryId: 1, amountMinor: 120000, occurredOn: "2026-06-10" }),
    tx({ categoryId: 2, amountMinor: 80000, occurredOn: "2026-08-31" }),
    income(6000000, "2026-09-01"),
    tx({ categoryId: 1, amountMinor: 200000, occurredOn: "2026-09-30" }),
    tx({ categoryId: 2, amountMinor: 50000, occurredOn: "2026-09-15" }),
    income(7000000, "2026-10-01"),
    tx({ categoryId: 1, amountMinor: 400000, occurredOn: "2026-10-31" }),
    tx({ categoryId: 3, amountMinor: 100000, occurredOn: "2026-10-05" }),
    income(8000000, "2026-11-01"),
    tx({ categoryId: 1, amountMinor: 300000, occurredOn: "2026-11-02" }),
    tx({ categoryId: 2, amountMinor: 90000, occurredOn: "2026-11-30" }),
    tx({ categoryId: 3, amountMinor: 10000, occurredOn: "2026-12-05" }), // dated next month
  ];

  it("this month gives exactly the figures the app already showed (computeStats)", () => {
    const transactions = ledger();
    const old = computeStats(transactions, TODAY);
    const now = stats(transactions, "this-month");
    expect(now.incomeMinor).toBe(old.monthIncomeMinor);
    expect(now.expenseMinor).toBe(old.monthExpenseMinor);
    expect(now.savedMinor).toBe(old.monthSavedMinor);
    expect(now.savingsRatePct).toBe(old.savingsRatePct);
    expect(now.prevExpenseMinor).toBe(old.prevMonthExpenseMinor);
    expect(now.expenseChangePct).toBe(old.expenseChangePct);
    expect(now.expenseByCategory).toEqual(old.expenseByCategory);
    expect(now.balanceMinor).toBe(old.balanceMinor);
    expect(now.trend).toEqual(old.trend);
    expect(now.series).toEqual(old.trend); // a single month shows the six months around it, as before
  });

  it("last month counts only that month, with 31 Oct and 1 Oct on the right side of the line", () => {
    const now = stats(ledger(), "last-month");
    expect(now.incomeMinor).toBe(7000000);
    expect(now.expenseMinor).toBe(500000);
    expect(now.savedMinor).toBe(6500000);
    expect(now.entryCount).toBe(3);
    expect(now.expenseByCategory).toEqual(new Map([[1, 400000], [3, 100000]]));
    // compared with September: 200000 + 50000 spent
    expect(now.prevExpenseMinor).toBe(250000);
    expect(now.expenseChangePct).toBe(100);
    expect(now.previousByCategory).toEqual(new Map([[1, 200000], [2, 50000]]));
  });

  it("a past period's balance stops at the end of that period", () => {
    const transactions = ledger();
    const sum = (upTo: string) => transactions.filter((t) => t.occurredOn <= upTo).reduce((s, t) => s + (t.kind === "income" ? t.amountMinor : -t.amountMinor), 0);
    expect(stats(transactions, "last-month").balanceMinor).toBe(sum("2026-10-31"));
    expect(stats(transactions, "2026-08").balanceMinor).toBe(sum("2026-08-31"));
    // a period that includes this month counts everything, even the entry dated in December
    expect(stats(transactions, "last-3").balanceMinor).toBe(sum("9999-12-31"));
  });

  it("last 3 months adds up the three months and compares with the three before", () => {
    const now = stats(ledger(), "last-3");
    expect(now.incomeMinor).toBe(6000000 + 7000000 + 8000000);
    expect(now.expenseMinor).toBe(200000 + 50000 + 400000 + 100000 + 300000 + 90000);
    expect(now.entryCount).toBe(9);
    // Jun 1-Aug 31: 120000 + 80000
    expect(now.prevExpenseMinor).toBe(200000);
    expect(now.series.map((p) => p.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(now.series.map((p) => p.expenseMinor)).toEqual([250000, 500000, 390000]);
    expect(now.trend.map((p) => p.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("last 6 months uses all six months as its bars", () => {
    const now = stats(ledger(), "last-6");
    expect(now.series).toHaveLength(6);
    expect(now.series.map((p) => p.label)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(now.series).toEqual(now.trend);
  });

  it("a specific past month shows the six months ending with it", () => {
    const now = stats(ledger(), "2026-08");
    expect(now.expenseMinor).toBe(80000);
    expect(now.incomeMinor).toBe(0);
    expect(now.series.map((p) => p.key)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(now.trend).toEqual(now.series);
  });

  it("reports an empty period without inventing numbers", () => {
    const now = stats(ledger(), "2025-01");
    expect(now).toMatchObject({ incomeMinor: 0, expenseMinor: 0, savedMinor: 0, savingsRatePct: null, expenseChangePct: null, entryCount: 0, balanceMinor: 0 });
    expect(now.expenseByCategory.size).toBe(0);
    expect(stats([], "last-6")).toMatchObject({ incomeMinor: 0, balanceMinor: 0, savingsRatePct: null });
    expect(stats([], "this-month").series.length).toBeGreaterThanOrEqual(2);
  });

  it("a savings rate and an overspend", () => {
    const rich = stats([income(100000, "2026-11-01"), tx({ amountMinor: 25000, occurredOn: "2026-11-02" })], "this-month");
    expect(rich.savingsRatePct).toBe(75);
    const poor = stats([income(10000, "2026-11-01"), tx({ amountMinor: 25000, occurredOn: "2026-11-02" })], "this-month");
    expect(poor.savedMinor).toBe(-15000);
  });
});

describe("ledgerMonths", () => {
  it("spans the earliest to the latest entry month, always including this month", () => {
    const m = ledgerMonths([tx({ amountMinor: 1, occurredOn: "2025-03-09" }), tx({ amountMinor: 1, occurredOn: "2026-12-01" }), tx({ amountMinor: 1, occurredOn: "2026-04-02" })], TODAY);
    expect(m.min).toBe("2025-03");
    expect(m.max).toBe("2026-12");
    expect([...m.withEntries].sort()).toEqual(["2025-03", "2026-04", "2026-12"]);
  });

  it("is just this month for an empty ledger", () => {
    expect(ledgerMonths([], TODAY)).toEqual({ min: "2026-11", max: "2026-11", withEntries: new Set() });
  });

  it("does not let an old ledger end before this month", () => {
    expect(ledgerMonths([tx({ amountMinor: 1, occurredOn: "2024-01-01" })], TODAY).max).toBe("2026-11");
  });
});
