import { describe, expect, it } from "vitest";
import type { Budget, Category, Transaction } from "@/db/repo";
import { buildSidebarSummary } from "./sidebarSummary";
import { computeStats } from "./stats";

const TODAY = "2026-11-12"; // a Thursday, 18 days before month end

const category = (id: number, name: string): Category => ({ id, name, icon: "tag", color: "#2F7D5B", kind: "expense", archived: false });
const CATEGORIES = new Map([1, 2, 3].map((id) => [id, category(id, `Cat ${id}`)] as const));

let nextId = 1;
const tx = (over: Partial<Transaction> & Pick<Transaction, "amountMinor" | "occurredOn">): Transaction => ({
  id: nextId++,
  kind: "expense",
  categoryId: 1,
  note: "",
  createdAt: "2026-11-01T00:00:00.000Z",
  ...over,
});
const budget = (id: number, categoryId: number, amountMinor: number, period: Budget["period"] = "monthly"): Budget => ({
  id,
  categoryId,
  amountMinor,
  period,
  createdAt: "2026-11-01T00:00:00.000Z",
});

function summarise(transactions: Transaction[], budgets: Budget[]) {
  return buildSidebarSummary({ transactions, budgets, categoryById: CATEGORIES, stats: computeStats(transactions, TODAY), today: TODAY });
}

describe("buildSidebarSummary", () => {
  it("describes an empty vault without inventing numbers", () => {
    const s = summarise([], []);
    expect(s).toMatchObject({ month: "November", day: 12, lastDay: 30, monthEntries: 0, keptMinor: 0, incomeMinor: 0, expenseMinor: 0, alerts: 0, worst: "ok" });
    expect(s.budgets).toEqual([]);
  });

  it("counts only entries dated in the current month", () => {
    const s = summarise(
      [
        tx({ amountMinor: 100, occurredOn: "2026-11-01" }),
        tx({ amountMinor: 100, occurredOn: "2026-11-30" }),
        tx({ amountMinor: 100, occurredOn: "2026-10-31" }),
        tx({ amountMinor: 100, occurredOn: "2026-12-01" }),
      ],
      [],
    );
    expect(s.monthEntries).toBe(2);
  });

  it("reports kept, in and out for the month from the same stats as the Overview", () => {
    const s = summarise(
      [
        tx({ kind: "income", categoryId: 3, amountMinor: 8500000, occurredOn: "2026-11-01" }),
        tx({ amountMinor: 1500000, occurredOn: "2026-11-05" }),
        tx({ amountMinor: 999900, occurredOn: "2026-10-05" }), // last month: not in this month's figures
      ],
      [],
    );
    expect(s.incomeMinor).toBe(8500000);
    expect(s.expenseMinor).toBe(1500000);
    expect(s.keptMinor).toBe(7000000);
  });

  it("goes negative when the month is overspent", () => {
    const s = summarise([tx({ kind: "income", categoryId: 3, amountMinor: 1000, occurredOn: "2026-11-02" }), tx({ amountMinor: 5000, occurredOn: "2026-11-03" })], []);
    expect(s.keptMinor).toBe(-4000);
  });

  it("ranks budgets by how close they are to their limit and counts near and over as alerts", () => {
    const transactions = [
      tx({ categoryId: 1, amountMinor: 20000, occurredOn: "2026-11-02" }), // 20% of 100000
      tx({ categoryId: 2, amountMinor: 85000, occurredOn: "2026-11-03" }), // 85% of 100000: near
      tx({ categoryId: 3, amountMinor: 130000, occurredOn: "2026-11-04" }), // 130% of 100000: over
    ];
    const s = summarise(transactions, [budget(1, 1, 100000), budget(2, 2, 100000), budget(3, 3, 100000)]);
    expect(s.budgets.map((b) => b.budget.id)).toEqual([3, 2, 1]);
    expect(s.budgets.map((b) => b.status)).toEqual(["over", "near", "ok"]);
    expect(s.alerts).toBe(2);
    expect(s.worst).toBe("over");
    expect(s.budgets[0].category?.name).toBe("Cat 3");
  });

  it("reports the worst state as near when nothing is over", () => {
    const s = summarise([tx({ categoryId: 1, amountMinor: 80000, occurredOn: "2026-11-02" })], [budget(1, 1, 100000)]);
    expect(s.alerts).toBe(1);
    expect(s.worst).toBe("near");
  });

  it("counts a budget as over only from 100% and near from 80%", () => {
    const at = (spent: number) => summarise([tx({ categoryId: 1, amountMinor: spent, occurredOn: "2026-11-02" })], [budget(1, 1, 100000)]);
    expect(at(79999).worst).toBe("ok");
    expect(at(80000).worst).toBe("near");
    expect(at(99999).worst).toBe("near");
    expect(at(100000).worst).toBe("over");
  });

  it("only counts a budget's spending inside its own current period", () => {
    const transactions = [
      tx({ categoryId: 1, amountMinor: 90000, occurredOn: "2026-10-20" }), // last month: ignored by a monthly budget
      tx({ categoryId: 1, amountMinor: 10000, occurredOn: "2026-11-10" }),
    ];
    const s = summarise(transactions, [budget(1, 1, 100000, "monthly")]);
    expect(s.budgets[0].spentMinor).toBe(10000);
    expect(s.alerts).toBe(0);
  });

  it("keeps a stable order for budgets at the same percentage", () => {
    const s = summarise([], [budget(5, 1, 1000), budget(2, 2, 1000), budget(9, 3, 1000)]);
    expect(s.budgets.map((b) => b.budget.id)).toEqual([2, 5, 9]);
  });

  it("copes with a budget whose category is gone", () => {
    const s = summarise([], [budget(1, 99, 1000)]);
    expect(s.budgets[0].category).toBeUndefined();
  });
});
