import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "@/db/repo";
import { csvCell, toCsv, transactionsToCsv } from "./csv";
import { computeInsights } from "./insights";
import { estimateStrength } from "./password";
import { parseQuickEntry } from "./quickEntry";

const cats: Category[] = [
  { id: 1, name: "Salary", icon: "Banknote", color: "#2F7D5B", kind: "income", archived: false },
  { id: 2, name: "Food & Dining", icon: "Utensils", color: "#C2702E", kind: "expense", archived: false },
  { id: 3, name: "Transportation", icon: "Bus", color: "#3B6FB0", kind: "expense", archived: false },
  { id: 4, name: "Shopping", icon: "ShoppingBag", color: "#B04A7A", kind: "expense", archived: false },
];
const byId = new Map(cats.map((c) => [c.id, c]));
const TODAY = "2026-11-11";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("defuses spreadsheet formulas in free text", () => {
    for (const evil of ['=HYPERLINK("http://x","y")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(csvCell(evil).replace(/^"/, "")).toMatch(/^'/);
    }
    expect(csvCell(-5)).toBe("-5"); // our own numeric cells stay numeric
  });
  it("builds a BOM + CRLF file with plain-decimal amounts", () => {
    const txns: Transaction[] = [
      { id: 1, kind: "expense", amountMinor: 125050, categoryId: 2, note: "=cmd, lunch", occurredOn: "2026-11-01", createdAt: "x" },
    ];
    const csv = transactionsToCsv(txns, byId, "BDT");
    expect(csv.startsWith("﻿Date,Type,Category,Note,Amount (BDT)\r\n")).toBe(true);
    expect(csv).toContain('2026-11-01,Expense,Food & Dining,"\'=cmd, lunch",1250.50');
    expect(toCsv([["a"]])).toBe("﻿a\r\n");
  });
});

describe("password strength", () => {
  it("scores sensibly and never rates short or common passwords as strong", () => {
    expect(estimateStrength("").score).toBe(0);
    expect(estimateStrength("abc").label).toBe("Too short");
    expect(estimateStrength("password123456").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("aaaaaaaaaaaaaaaa").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("Tr0ub4dor&3xKq").score).toBeGreaterThanOrEqual(3);
    expect(estimateStrength("correct horse battery staple").score).toBeGreaterThanOrEqual(3);
    expect(estimateStrength("correct horse battery staple plum").score).toBe(4);
  });
  it("treats a common word as one cheap guess, not as a reason to fail a long passphrase", () => {
    expect(estimateStrength("password123").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("1234567890").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("a different long password").score).toBeGreaterThanOrEqual(3);
  });
});

describe("quick entry parser", () => {
  const parse = (text: string) => parseQuickEntry(text, cats, TODAY);

  it("parses amount and note", () => {
    expect(parse("tea 40")).toMatchObject({ kind: "expense", amountMinor: 4000, occurredOn: TODAY, note: "tea", categoryId: null });
    expect(parse("40 tea").note).toBe("tea");
    expect(parse("৳1,250.50 groceries").amountMinor).toBe(125050);
    expect(parse("lunch 250tk").amountMinor).toBe(25000);
  });
  it("matches categories by word prefix", () => {
    expect(parse("lunch 250 food")).toMatchObject({ categoryId: 2, amountMinor: 25000, note: "lunch" });
    expect(parse("rickshaw 60 transport")).toMatchObject({ categoryId: 3, note: "rickshaw" });
    expect(parse("shop 900").categoryId).toBe(4);
  });
  it("understands dates without mistaking them for the amount", () => {
    expect(parse("tea 40 yesterday").occurredOn).toBe("2026-11-10");
    expect(parse("tea 40 3 days ago")).toMatchObject({ occurredOn: "2026-11-08", amountMinor: 4000 });
    expect(parse("tea 40 3 nov")).toMatchObject({ occurredOn: "2026-11-03", amountMinor: 4000 });
    expect(parse("tea 40 nov 3").occurredOn).toBe("2026-11-03");
    expect(parse("tea 40 2026-10-05").occurredOn).toBe("2026-10-05");
    expect(parse("tea 40 20 dec").occurredOn).toBe("2025-12-20"); // a future day-month means last year
    expect(parse("tea 40 31 feb").occurredOn).toBe(TODAY); // impossible date is ignored
  });
  it("detects income", () => {
    expect(parse("+85000 salary")).toMatchObject({ kind: "income", amountMinor: 8500000, categoryId: 1 });
    expect(parse("freelance payment 12000 income")).toMatchObject({ kind: "income", amountMinor: 1200000 });
  });
  it("reports a missing amount instead of guessing", () => {
    expect(parse("just a note")).toMatchObject({ amountMinor: null, note: "just a note" });
    expect(parse("")).toMatchObject({ amountMinor: null, note: "" });
  });
});

describe("insights", () => {
  const t = (id: number, kind: "income" | "expense", categoryId: number, amountMinor: number, occurredOn: string): Transaction => ({
    id, kind, categoryId, amountMinor, occurredOn, note: "", createdAt: "x",
  });
  it("compares the same elapsed days of last month and formats in the vault currency", () => {
    const txns = [
      t(1, "income", 1, 8000000, "2026-11-01"),
      t(2, "expense", 2, 100000, "2026-10-05"),
      t(3, "expense", 2, 900000, "2026-10-25"), // after day 11 → must not count toward the comparison
      t(4, "expense", 2, 150000, "2026-11-05"),
    ];
    const insights = computeInsights(txns, byId, "BDT", TODAY);
    const up = insights.find((i) => i.id === "category-up")!;
    expect(up.text).toContain("Food & Dining is 50% higher");
    expect(up.text).toContain("৳500");
    expect(insights.find((i) => i.id === "savings")!.text).toContain("৳78,500");
    expect(insights.length).toBeLessThanOrEqual(3);
  });
  it("says nothing when there is nothing to say", () => {
    expect(computeInsights([], byId, "BDT", TODAY)).toEqual([]);
  });
});
