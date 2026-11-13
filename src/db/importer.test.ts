import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { transactionsToCsv } from "@/lib/csv";
import { parseLedgerCsv } from "@/lib/csvImport";
import { type ImportSource, planImport } from "@/lib/importPlan";
import { ValidationError, addCategory, addTransaction, countCategoryUsage, listBudgets, listCategories, listTransactions, setCategoryArchived, setMeta, upsertBudget } from "./repo";
import { applyImport, readImportSource, undoImport } from "./importer";
import { migrate } from "./schema";
import { type Database, type SqlJsStatic, query } from "./sql";

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

function freshDb(): Database {
  const db = new SQL.Database();
  migrate(db);
  setMeta(db, "currency", "BDT");
  return db;
}
const cat = (db: Database, name: string, kind: "income" | "expense" = "expense") => listCategories(db, { includeArchived: true }).find((c) => c.name === name && c.kind === kind)!;
const existing = (db: Database) => ({ categories: listCategories(db, { includeArchived: true }), transactions: listTransactions(db), budgets: listBudgets(db) });
/** Entries as a person would compare them: no ids, category by name. */
function snapshot(db: Database) {
  const names = new Map(listCategories(db, { includeArchived: true }).map((c) => [c.id, c.name]));
  return listTransactions(db).map((t) => [t.occurredOn, t.kind, names.get(t.categoryId), t.amountMinor, t.note]);
}
function exportCsv(db: Database): string {
  const categories = listCategories(db, { includeArchived: true });
  return transactionsToCsv(listTransactions(db), new Map(categories.map((c) => [c.id, c])), "BDT");
}
function importCsv(db: Database, text: string, skipDuplicates = true) {
  const parsed = parseLedgerCsv(text, "BDT");
  const plan = planImport(parsed.source, existing(db), { skipDuplicates });
  return { parsed, plan, result: applyImport(db, plan) };
}

function seed(db: Database) {
  const food = cat(db, "Food & Dining").id;
  const salary = cat(db, "Salary", "income").id;
  const add = (categoryId: number, kind: "income" | "expense", amountMinor: number, note: string, occurredOn: string) => addTransaction(db, { kind, amountMinor, categoryId, note, occurredOn });
  add(food, "expense", 25000, "lunch, with “friends”", "2026-11-01");
  add(food, "expense", 25000, "lunch, with “friends”", "2026-11-01"); // an identical twin on purpose
  add(food, "expense", 1, "smallest unit", "2026-11-01");
  add(food, "expense", 9_999_999_999, "=HYPERLINK(\"http://x\",\"y\")", "2026-10-31");
  add(food, "expense", 100, "'=already quoted", "2026-10-31");
  add(food, "expense", 100, "-5 degrees", "2026-10-30");
  add(food, "expense", 100, 'say "hi"\nnew line', "2026-10-30");
  add(food, "expense", 100, "বাংলা নোট ৳১২৫০", "2026-10-29");
  add(salary, "income", 5_000_000, "", "2026-10-28");
  add(salary, "income", 123456, "bonus", "2026-01-01");
}

describe("CSV round trip: what the app exports, it imports back unchanged", () => {
  it("restores every entry in the same order into an empty vault", () => {
    const source = freshDb();
    seed(source);
    const text = exportCsv(source);

    const target = freshDb();
    const { parsed, plan } = importCsv(target, text);
    expect(parsed.problems).toEqual([]);
    expect(plan.newCategories).toEqual([]); // both vaults start with the default categories
    expect(snapshot(target)).toEqual(snapshot(source));
    expect(snapshot(target)).toHaveLength(10);
  });

  it("adds nothing when the same file is imported again, and exactly doubles when told not to skip", () => {
    const db = freshDb();
    seed(db);
    const before = snapshot(db);
    const again = importCsv(db, exportCsv(db));
    expect(again.plan.duplicates).toBe(10);
    expect(again.result.transactionIds).toEqual([]);
    expect(snapshot(db)).toEqual(before);

    importCsv(db, exportCsv(db), false);
    expect(listTransactions(db)).toHaveLength(20);
  });

  it("imports only what is missing from a file that overlaps the vault", () => {
    const db = freshDb();
    seed(db);
    const text = exportCsv(db);
    addTransaction(db, { kind: "expense", amountMinor: 700, categoryId: cat(db, "Shopping").id, note: "new", occurredOn: "2026-11-05" });
    const other = freshDb();
    importCsv(other, text); // a second device that only has the first ten
    const { plan } = importCsv(other, exportCsv(db)); // now bring in the eleventh
    expect(plan.duplicates).toBe(10);
    expect(plan.entries).toHaveLength(1);
    expect(snapshot(other)).toEqual(snapshot(db));
  });

  it("creates categories the vault does not have, in the right type, and uses them", () => {
    const source = freshDb();
    const pets = addCategory(source, { name: "Pets", icon: "PawPrint", color: "#5C5FAD", kind: "expense" });
    addCategory(source, { name: "Pets", icon: "PawPrint", color: "#5C5FAD", kind: "income" });
    addTransaction(source, { kind: "expense", amountMinor: 4000, categoryId: pets.id, occurredOn: "2026-11-01" });
    addTransaction(source, { kind: "income", amountMinor: 900, categoryId: cat(source, "Pets", "income").id, occurredOn: "2026-11-02" });

    const target = freshDb();
    const { plan, result } = importCsv(target, exportCsv(source));
    expect(plan.newCategories.map((c) => [c.name, c.kind]).sort()).toEqual([["Pets", "expense"], ["Pets", "income"]]);
    expect(result.categoryIds).toHaveLength(2);
    expect(snapshot(target)).toEqual(snapshot(source));
    expect(cat(target, "Pets", "income").kind).toBe("income");
    expect(cat(target, "Pets", "expense").icon).toBe("Tag");
  });
});

describe("applyImport", () => {
  it("is all or nothing: a bad entry rolls back the categories and entries saved before it", () => {
    const db = freshDb();
    const categoriesBefore = listCategories(db, { includeArchived: true }).length;
    const plan = planImport(
      {
        currency: null,
        categories: [],
        budgets: [],
        entries: [
          { kind: "expense", categoryName: "Brand new", amountMinor: 100, note: "", occurredOn: "2026-01-01" },
          { kind: "expense", categoryName: "Brand new", amountMinor: 100, note: "", occurredOn: "2026-13-45" }, // not a date
        ],
      },
      existing(db),
      { skipDuplicates: true },
    );
    expect(() => applyImport(db, plan)).toThrow(ValidationError);
    expect(listTransactions(db)).toEqual([]);
    expect(listCategories(db, { includeArchived: true })).toHaveLength(categoriesBefore);
  });

  it("refuses an entry whose type does not match its category's type", () => {
    const db = freshDb();
    const plan = planImport({ currency: null, categories: [], budgets: [], entries: [{ kind: "expense", categoryName: "Tea", amountMinor: 1, note: "", occurredOn: "2026-01-01" }] }, existing(db), { skipDuplicates: true });
    plan.entries[0].ref = { id: cat(db, "Salary", "income").id };
    expect(() => applyImport(db, plan)).toThrow(/type of its category/);
    expect(listTransactions(db)).toEqual([]);
  });

  it("stamps entries with the import time and keeps foreign keys on", () => {
    const db = freshDb();
    const now = new Date("2026-11-12T10:00:00.000Z");
    const parsed = parseLedgerCsv("Date,Type,Category,Note,Amount\r\n2026-11-01,Expense,Tea,,5", "BDT");
    applyImport(db, planImport(parsed.source, existing(db), { skipDuplicates: true }), now);
    expect(listTransactions(db)[0].createdAt).toBe("2026-11-12T10:00:00.000Z");
    expect(query<{ foreign_keys: number }>(db, "PRAGMA foreign_keys")[0].foreign_keys).toBe(1);
    expect(query(db, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("handles a large file quickly", () => {
    const db = freshDb();
    const lines = ["Date,Type,Category,Note,Amount (BDT)"];
    for (let i = 0; i < 20_000; i++) lines.push(`2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")},Expense,Cat ${i % 40},note ${i},${(i % 900) + 1}.25`);
    const started = performance.now();
    const { parsed, plan, result } = importCsv(db, lines.join("\r\n"));
    const took = performance.now() - started;
    expect(parsed.problems).toEqual([]);
    expect(plan.newCategories).toHaveLength(40);
    expect(result.transactionIds).toHaveLength(20_000);
    expect(listTransactions(db)).toHaveLength(20_000);
    expect(took).toBeLessThan(8000);
  });
});

describe("undoImport", () => {
  it("removes exactly what the import added: entries, new categories and new budgets", () => {
    const db = freshDb();
    seed(db);
    const before = snapshot(db);
    const categoriesBefore = listCategories(db, { includeArchived: true }).length;
    const source: ImportSource = {
      currency: null,
      categories: [{ name: "Pets", kind: "expense", icon: "PawPrint", color: "#5C5FAD", archived: false }],
      entries: [{ kind: "expense", categoryName: "Pets", amountMinor: 700, note: "x", occurredOn: "2026-11-09" }],
      budgets: [{ categoryName: "Pets", period: "monthly", amountMinor: 5000 }],
    };
    const result = applyImport(db, planImport(source, existing(db), { skipDuplicates: true }));
    expect(result).toMatchObject({ categoryIds: [expect.any(Number)], transactionIds: [expect.any(Number)], budgetIds: [expect.any(Number)] });
    expect(listBudgets(db)).toHaveLength(1);

    undoImport(db, result);
    expect(snapshot(db)).toEqual(before);
    expect(listBudgets(db)).toEqual([]);
    expect(listCategories(db, { includeArchived: true })).toHaveLength(categoriesBefore);
  });

  it("keeps a category the person has used since, and its budget", () => {
    const db = freshDb();
    const parsed = parseLedgerCsv("Date,Type,Category,Note,Amount\r\n2026-11-01,Expense,Pets,,5", "BDT");
    const result = applyImport(db, planImport(parsed.source, existing(db), { skipDuplicates: true }));
    const pets = cat(db, "Pets");
    addTransaction(db, { kind: "expense", amountMinor: 900, categoryId: pets.id, note: "added afterwards", occurredOn: "2026-11-02" });
    undoImport(db, result);
    expect(listTransactions(db).map((t) => t.note)).toEqual(["added afterwards"]);
    expect(countCategoryUsage(db, pets.id)).toBe(1);

    const parsedAgain = parseLedgerCsv("Date,Type,Category,Note,Amount\r\n2026-11-03,Expense,Cats,,5", "BDT");
    const second = applyImport(db, planImport(parsedAgain.source, existing(db), { skipDuplicates: true }));
    upsertBudget(db, { categoryId: cat(db, "Cats").id, amountMinor: 100, period: "weekly" });
    undoImport(db, second);
    expect(cat(db, "Cats")).toBeDefined(); // a budget now depends on it
  });
});

describe("importing a backup's contents", () => {
  it("brings entries, custom categories (icon, colour, archived state) and budgets into another vault", () => {
    const a = freshDb();
    seed(a);
    const pets = addCategory(a, { name: "Pets", icon: "PawPrint", color: "#7B7DBC", kind: "expense" });
    addTransaction(a, { kind: "expense", amountMinor: 6000, categoryId: pets.id, note: "vet", occurredOn: "2026-11-03" });
    upsertBudget(a, { categoryId: cat(a, "Food & Dining").id, amountMinor: 80000, period: "monthly" });
    upsertBudget(a, { categoryId: pets.id, amountMinor: 20000, period: "weekly" });
    const old = addCategory(a, { name: "Retired", icon: "Tag", color: "#7B7DBC", kind: "expense" });
    addTransaction(a, { kind: "expense", amountMinor: 300, categoryId: old.id, note: "old", occurredOn: "2026-02-01" });
    setCategoryArchived(a, old.id, true);

    const reopened = new SQL.Database(a.export()); // what a decrypted backup looks like
    migrate(reopened);
    const source = readImportSource(reopened);
    expect(source.currency).toBe("BDT");
    expect(source.entries).toHaveLength(12);
    expect(source.budgets).toHaveLength(2);

    const b = freshDb();
    upsertBudget(b, { categoryId: cat(b, "Food & Dining").id, amountMinor: 1234, period: "monthly" }); // already has this one
    const plan = planImport(source, existing(b), { skipDuplicates: true });
    expect(plan.budgetsKept).toBe(1);
    const result = applyImport(b, plan);
    expect(result.budgetIds).toHaveLength(1);

    expect(snapshot(b)).toEqual(snapshot(a));
    const importedPets = cat(b, "Pets");
    expect([importedPets.icon, importedPets.color, importedPets.archived]).toEqual(["PawPrint", "#7B7DBC", false]);
    expect(cat(b, "Retired").archived).toBe(true);
    expect(listBudgets(b).map((x) => [x.period, x.amountMinor]).sort()).toEqual([["monthly", 1234], ["weekly", 20000]]); // the vault's own budget wins

    // a second import is a no-op
    const again = planImport(source, existing(b), { skipDuplicates: true });
    expect([again.entries.length, again.budgets.length, again.newCategories.length]).toEqual([0, 0, 0]);
  });
});
