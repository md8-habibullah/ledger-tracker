import { describe, expect, it } from "vitest";
import type { Budget, Category, Transaction } from "@/db/repo";
import { csvCell, toCsv, transactionsToCsv, unguardCell } from "./csv";
import { ImportFileError, parseCsv, parseImportAmount, parseLedgerCsv } from "./csvImport";
import { type ImportSource, isEmptyPlan, planImport } from "./importPlan";
import { CATEGORY_COLORS } from "./icons";

const HEADER = "Date,Type,Category,Note,Amount (BDT)";
const csv = (...lines: string[]) => lines.join("\r\n");

describe("parseCsv", () => {
  it("reads plain rows with CRLF, LF and CR endings, with or without a final newline", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseCsv("a,b\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseCsv("a,b\rc,d\r")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("reads quoted cells holding delimiters, doubled quotes and line breaks", () => {
    expect(parseCsv('"a,b","say ""hi""","l1\r\nl2",x')).toEqual([["a,b", 'say "hi"', "l1\r\nl2", "x"]]);
  });
  it("keeps empty cells, including at the end of a row", () => {
    expect(parseCsv("a,,c,\n,,")).toEqual([["a", "", "c", ""], ["", "", ""]]);
  });
  it("treats a quote in the middle of a cell as a literal character", () => {
    expect(parseCsv('5" pipe,x')).toEqual([['5" pipe', "x"]]);
  });
  it("refuses a file that ends inside a quoted cell instead of swallowing the rest of it", () => {
    expect(() => parseCsv('a,"never closed\nb,c')).toThrow(ImportFileError);
  });
  it("is the exact inverse of toCsv for any text", () => {
    const rows = [["a,b", 'q"uote', "line\nbreak", "  spaced  ", "বাংলা", ""], ["x", "y", "z", "", "", ""]];
    expect(parseCsv(toCsv(rows).replace(/^\uFEFF/, ""))).toEqual(rows);
  });
});

describe("the spreadsheet formula guard is reversible", () => {
  it("removes exactly the apostrophe the export added", () => {
    for (const text of ["=SUM(A1)", "+1", "-5 degrees", "@here", "'=already quoted", "''-x", "plain", "'plain", "it's", ""]) {
      expect(unguardCell(csvCell(text).replace(/^"|"$/g, "").replace(/""/g, '"'))).toBe(text);
    }
  });
  it("leaves ordinary apostrophes alone", () => {
    expect(unguardCell("'hello")).toBe("'hello");
    expect(unguardCell("=typed by hand")).toBe("=typed by hand");
  });
});

describe("parseImportAmount", () => {
  it.each([
    ["250", 25000],
    ["1250.50", 125050],
    ["1,250.50", 125050],
    ["12,34,567.89", 123456789],
    ["1,00,000", 10000000],
    ["৳ 80", 8000],
    ["$12.5", 1250],
    ["BDT 80", 8000],
    ["১২৫০.৫০", 125050],
    [".5", 50],
    ["  42  ", 4200],
  ])("reads %s as %i minor units", (text, minor) => {
    expect(parseImportAmount(text, "BDT")).toBe(minor);
  });

  it.each([
    "1250,50", // a decimal comma is ambiguous, so it is refused instead of becoming 125,050
    "12,50",
    "1,25",
    "-5",
    "−5",
    "(5)",
    "0",
    "0.00",
    "1.234",
    "12abc",
    "5 BDT",
    "1 250",
    "",
    "   ",
    ".",
    "NaN",
    "1e3",
    "99999999999999999999",
  ])("refuses %j", (text) => {
    expect(parseImportAmount(text, "BDT")).toBeNull();
  });

  it("follows the currency's decimal places", () => {
    expect(parseImportAmount("500", "JPY")).toBe(500);
    expect(parseImportAmount("5.5", "JPY")).toBeNull();
    expect(parseImportAmount("5.5", "USD")).toBe(550);
  });
});

describe("parseLedgerCsv", () => {
  it("reads the file the app exports", () => {
    const parsed = parseLedgerCsv(`\uFEFF${csv(HEADER, "2026-11-01,Expense,Food & Dining,lunch,250.00", "2026-10-31,Income,Salary,,50000.00", "")}`, "BDT");
    expect(parsed.problems).toEqual([]);
    expect(parsed.fileCurrency).toBe("BDT");
    expect(parsed.rowCount).toBe(2);
    expect(parsed.source.entries).toEqual([
      { row: 2, kind: "expense", categoryName: "Food & Dining", amountMinor: 25000, note: "lunch", occurredOn: "2026-11-01" },
      { row: 3, kind: "income", categoryName: "Salary", amountMinor: 5000000, note: "", occurredOn: "2026-10-31" },
    ]);
  });

  it("accepts columns in any order, no note column, any case, and other delimiters", () => {
    const reordered = parseLedgerCsv(csv("amount,CATEGORY,date,Type", "5,Tea,2026-01-02,expense"), "BDT");
    expect(reordered.source.entries).toMatchObject([{ amountMinor: 500, categoryName: "Tea", occurredOn: "2026-01-02", kind: "expense", note: "" }]);
    expect(reordered.fileCurrency).toBeNull();

    const semicolons = parseLedgerCsv(csv("Date;Type;Category;Note;Amount (BDT)", "2026-01-02;Income;Salary;bonus, march;1,000.00"), "BDT");
    expect(semicolons.source.entries[0]).toMatchObject({ note: "bonus, march", amountMinor: 100000 });

    const tabs = parseLedgerCsv("Date\tType\tCategory\tNote\tAmount\n2026-01-02\tMoney out\tTea\tx\t5", "BDT");
    expect(tabs.source.entries[0]).toMatchObject({ kind: "expense", amountMinor: 500 });
  });

  it("skips blank lines and reports each bad row by its spreadsheet row number, importing the rest", () => {
    const parsed = parseLedgerCsv(
      csv(
        HEADER,
        "2026-11-01,Expense,Tea,,10.00",
        ",,,,",
        "11/02/2026,Expense,Tea,,10.00",
        "2026-11-03,Refund,Tea,,10.00",
        "2026-11-04,Expense,,,10.00",
        "2026-11-05,Expense,Tea,,ten",
        "2026-11-06,Expense,Tea,,-4",
        "2026-02-30,Expense,Tea,,1.00",
        "2026-11-07,Expense,Tea,fine,1250,50",
        "2026-11-08,Income,Salary,ok,5.00",
      ),
      "BDT",
    );
    expect(parsed.rowCount).toBe(9);
    expect(parsed.source.entries.map((e) => e.row)).toEqual([2, 11]);
    expect(parsed.problems.map((p) => p.row)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(parsed.problems[0].message).toMatch(/not a date.*YYYY-MM-DD/);
    expect(parsed.problems[1].message).toMatch(/not Income or Expense/);
    expect(parsed.problems[2].message).toMatch(/category is empty/);
    expect(parsed.problems[3].message).toMatch(/not a usable amount.*dot/);
    expect(parsed.problems[5].message).toMatch(/not a date/);
    // "1250,50" typed without quotes splits into two cells: refuse the row instead of reading 1250.
    expect(parsed.problems[6].message).toMatch(/7 cells but the header has 5|6 cells but the header has 5/);
  });

  it("tolerates padding cells at the end of a row, but not extra data", () => {
    expect(parseLedgerCsv(csv(HEADER, "2026-11-01,Expense,Tea,,10.00,,"), "BDT").problems).toEqual([]);
    expect(parseLedgerCsv(csv(HEADER, "2026-11-01,Expense,Tea,,10.00,extra"), "BDT").problems).toHaveLength(1);
  });

  it("reads a row that has too few cells as having empty cells, not as a crash", () => {
    const parsed = parseLedgerCsv(csv(HEADER, "2026-11-01,Expense"), "BDT");
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.problems[0].message).toMatch(/category is empty/);
  });

  it("rejects over-long names and notes as row problems", () => {
    const parsed = parseLedgerCsv(csv(HEADER, `2026-11-01,Expense,${"c".repeat(61)},,1`, `2026-11-01,Expense,Tea,${"n".repeat(501)},1`), "BDT");
    expect(parsed.problems.map((p) => p.message)).toEqual([expect.stringMatching(/category name is longer/), expect.stringMatching(/note is longer/)]);
  });

  it.each([
    ["an empty file", ""],
    ["only blanks", "\r\n\r\n,,,\r\n"],
    ["a file with no recognisable header", "foo,bar\r\n1,2"],
    ["a header missing the amount", "Date,Type,Category,Note\r\n2026-01-01,Expense,Tea,x"],
    ["a damaged file", `${HEADER}\r\n2026-01-01,Expense,"Tea,x,5`],
  ])("refuses %s with a clear message", (_label, text) => {
    expect(() => parseLedgerCsv(text, "BDT")).toThrow(ImportFileError);
  });

  it("names the missing columns", () => {
    expect(() => parseLedgerCsv("Date,Note\r\n2026-01-01,x", "BDT")).toThrow(/Type, Category, Amount are missing/);
  });

  it("undoes the formula guard on notes and category names", () => {
    const parsed = parseLedgerCsv(csv(HEADER, `2026-11-01,Expense,'-Misc,"'=HYPERLINK(""x"")",5`), "BDT");
    expect(parsed.source.entries[0]).toMatchObject({ categoryName: "-Misc", note: '=HYPERLINK("x")' });
  });

  it("refuses more rows than it will hold", () => {
    const lines = [HEADER, ...Array.from({ length: 100_001 }, () => "2026-01-01,Expense,Tea,,1")];
    expect(() => parseLedgerCsv(csv(...lines), "BDT")).toThrow(/more than 100,000 rows/);
  });
});

// ------------------------------------------------------------------ planning

const category = (id: number, name: string, kind: "income" | "expense", archived = false): Category => ({ id, name, icon: "Tag", color: CATEGORY_COLORS[0], kind, archived });
const txn = (id: number, categoryId: number, kind: "income" | "expense", amountMinor: number, note: string, occurredOn: string): Transaction => ({ id, kind, amountMinor, categoryId, note, occurredOn, createdAt: "x" });
const budget = (id: number, categoryId: number, amountMinor: number, period: "weekly" | "monthly" | "yearly"): Budget => ({ id, categoryId, amountMinor, period, createdAt: "x" });
const entry = (kind: "income" | "expense", categoryName: string, amountMinor: number, note: string, occurredOn: string) => ({ kind, categoryName, amountMinor, note, occurredOn });
const source = (entries: ImportSource["entries"], extra: Partial<ImportSource> = {}): ImportSource => ({ currency: null, categories: [], budgets: [], entries, ...extra });
const EXISTING = {
  categories: [category(1, "Salary", "income"), category(2, "Food & Dining", "expense"), category(3, "Food & Dining", "income"), category(4, "Old", "expense", true)],
  transactions: [] as Transaction[],
  budgets: [] as Budget[],
};

describe("planImport: categories", () => {
  it("matches by type and name, ignoring case and spacing, and never across types", () => {
    const plan = planImport(source([entry("expense", "  food & DINING ", 100, "", "2026-01-01"), entry("income", "Food & Dining", 100, "", "2026-01-01")]), EXISTING, { skipDuplicates: true });
    expect(plan.newCategories).toEqual([]);
    expect(plan.entries.map((e) => e.ref)).toEqual([{ id: 3 }, { id: 2 }]);
  });

  it("prefers the exact, un-archived match when several categories fit", () => {
    const existing = { ...EXISTING, categories: [category(1, "tea", "expense"), category(2, "Tea", "expense", true), category(3, "Tea", "expense")] };
    expect(planImport(source([entry("expense", "Tea", 1, "", "2026-01-01")]), existing, { skipDuplicates: true }).entries[0].ref).toEqual({ id: 3 });
    expect(planImport(source([entry("expense", "TEA", 1, "", "2026-01-01")]), existing, { skipDuplicates: true }).entries[0].ref).toEqual({ id: 1 });
  });

  it("uses an archived category rather than making a twin of it", () => {
    const plan = planImport(source([entry("expense", "Old", 1, "", "2026-01-01")]), EXISTING, { skipDuplicates: true });
    expect(plan.newCategories).toEqual([]);
    expect(plan.entries[0].ref).toEqual({ id: 4 });
  });

  it("creates one new category per type and name, with a tag icon and palette colours in turn", () => {
    const plan = planImport(
      source([entry("expense", "Pets", 1, "", "2026-01-01"), entry("expense", "pets", 1, "", "2026-01-02"), entry("income", "Pets", 1, "", "2026-01-03"), entry("expense", "Gym", 1, "", "2026-01-04")]),
      EXISTING,
      { skipDuplicates: true },
    );
    expect(plan.newCategories.map((c) => [c.name, c.kind, c.icon])).toEqual([["Pets", "expense", "Tag"], ["Pets", "income", "Tag"], ["Gym", "expense", "Tag"]]);
    const start = EXISTING.categories.length;
    expect(plan.newCategories.map((c) => c.color)).toEqual([0, 1, 2].map((i) => CATEGORY_COLORS[(start + i) % CATEGORY_COLORS.length]));
    // both spellings of the first one resolve to the same new category
    expect(plan.entries.filter((e) => "key" in e.ref && e.ref.key === plan.newCategories[0].key)).toHaveLength(2);
  });

  it("carries a backup's own icon and colour, shows an old rainbow colour as its current tone, and skips unused archived ones", () => {
    const plan = planImport(
      source([entry("expense", "Pets", 1, "", "2026-01-01")], {
        categories: [
          { name: "Pets", kind: "expense", icon: "PawPrint", color: "#d34558", archived: false },
          { name: "Hobby", kind: "expense", icon: "Gamepad2", color: CATEGORY_COLORS[3], archived: false },
          { name: "Gone", kind: "expense", icon: "Tag", color: CATEGORY_COLORS[3], archived: true },
        ],
      }),
      EXISTING,
      { skipDuplicates: true },
    );
    expect(plan.newCategories.map((c) => [c.name, c.icon, c.color])).toEqual([["Pets", "PawPrint", "#5C5FAD"], ["Hobby", "Gamepad2", CATEGORY_COLORS[3]]]);
  });
});

describe("planImport: duplicates", () => {
  const existing = {
    ...EXISTING,
    transactions: [txn(10, 2, "expense", 25000, "lunch", "2026-11-01"), txn(11, 2, "expense", 25000, "lunch", "2026-11-01"), txn(12, 1, "income", 100, "", "2026-11-02")],
  };
  const lunch = entry("expense", "Food & Dining", 25000, "lunch", "2026-11-01");

  it("counts identical entries one for one", () => {
    const plan = planImport(source([lunch, lunch, lunch]), existing, { skipDuplicates: true });
    expect(plan.duplicates).toBe(2);
    expect(plan.entries).toHaveLength(1);
  });

  it("treats a different day, type, category, amount or note as a new entry", () => {
    const plan = planImport(
      source([
        { ...lunch, occurredOn: "2026-11-02" },
        { ...lunch, amountMinor: 25001 },
        { ...lunch, note: "Lunch" },
        entry("income", "Food & Dining", 25000, "lunch", "2026-11-01"),
        entry("expense", "Old", 25000, "lunch", "2026-11-01"),
      ]),
      existing,
      { skipDuplicates: true },
    );
    expect(plan.duplicates).toBe(0);
    expect(plan.entries).toHaveLength(5);
  });

  it("keeps two identical entries from the file when the vault has none", () => {
    const plan = planImport(source([entry("expense", "Tea", 500, "", "2026-01-01"), entry("expense", "Tea", 500, "", "2026-01-01")]), existing, { skipDuplicates: true });
    expect(plan.entries).toHaveLength(2);
  });

  it("imports everything when skipping is switched off", () => {
    const plan = planImport(source([lunch, lunch, lunch]), existing, { skipDuplicates: false });
    expect(plan.duplicates).toBe(0);
    expect(plan.entries).toHaveLength(3);
  });

  it("compares notes after trimming, as they are stored", () => {
    expect(planImport(source([{ ...lunch, note: "  lunch " }]), existing, { skipDuplicates: true }).duplicates).toBe(1);
  });

  it("plans a file that is entirely already there as empty", () => {
    const plan = planImport(source([lunch, lunch, entry("income", "Salary", 100, "", "2026-11-02")]), existing, { skipDuplicates: true });
    expect(plan.duplicates).toBe(3);
    expect(isEmptyPlan(plan)).toBe(true);
  });
});

describe("planImport: order, totals and budgets", () => {
  it("lists entries oldest first, so an export (newest first) is saved back in its own order", () => {
    const plan = planImport(source([entry("expense", "Tea", 3, "c", "2026-01-02"), entry("expense", "Tea", 2, "b", "2026-01-02"), entry("expense", "Tea", 1, "a", "2026-01-01")]), EXISTING, { skipDuplicates: true });
    expect(plan.entries.map((e) => e.note)).toEqual(["a", "b", "c"]);
  });

  it("totals what it will add and reports the date span", () => {
    const plan = planImport(source([entry("income", "Salary", 500, "", "2026-03-01"), entry("expense", "Tea", 120, "", "2026-01-15"), entry("expense", "Tea", 80, "", "2026-02-01")]), EXISTING, { skipDuplicates: true });
    expect(plan.totals).toEqual({ income: 500, expense: 200 });
    expect(plan.dateRange).toEqual({ from: "2026-01-15", to: "2026-03-01" });
    expect(planImport(source([]), EXISTING, { skipDuplicates: true }).dateRange).toBeNull();
  });

  it("adds a budget only where the vault has none for that category and period", () => {
    const existing = { ...EXISTING, budgets: [budget(1, 2, 9000, "monthly")] };
    const plan = planImport(
      source([], {
        budgets: [
          { categoryName: "Food & Dining", period: "monthly", amountMinor: 1 },
          { categoryName: "Food & Dining", period: "weekly", amountMinor: 2000 },
          { categoryName: "Pets", period: "monthly", amountMinor: 3000 },
        ],
        categories: [{ name: "Pets", kind: "expense", icon: "PawPrint", color: CATEGORY_COLORS[0], archived: false }],
      }),
      existing,
      { skipDuplicates: true },
    );
    expect(plan.budgetsKept).toBe(1);
    expect(plan.budgets.map((b) => [b.ref, b.period, b.amountMinor])).toEqual([[{ id: 2 }, "weekly", 2000], [{ key: "expense|pets" }, "monthly", 3000]]);
    expect(plan.newCategories.map((c) => c.name)).toEqual(["Pets"]);
  });
});

describe("export format", () => {
  it("round-trips the header the exporter writes", () => {
    const cats = new Map([[2, category(2, "Food & Dining", "expense")]]);
    const text = transactionsToCsv([txn(1, 2, "expense", 125050, "=cmd, \"x\"", "2026-11-01")], cats, "BDT");
    const parsed = parseLedgerCsv(text, "BDT");
    expect(parsed.problems).toEqual([]);
    expect(parsed.source.entries).toMatchObject([{ kind: "expense", amountMinor: 125050, categoryName: "Food & Dining", note: '=cmd, "x"', occurredOn: "2026-11-01" }]);
  });
});
