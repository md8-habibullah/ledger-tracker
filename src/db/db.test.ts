import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { computeStats, budgetProgress } from "@/lib/stats";
import {
  ValidationError, addCategory, addTransaction, countCategoryUsage, deleteCategory, deleteTransactions,
  getMeta, listBudgets, listCategories, listTransactions, mergeCategories, restoreTransactions, setCategoryArchived, setMeta,
  updateCategory, updateTransaction, upsertBudget,
} from "./repo";
import { DEFAULT_CATEGORIES, FutureSchemaError, LATEST_SCHEMA_VERSION, migrate, schemaVersion } from "./schema";
import { type Database, type SqlJsStatic, query, withTransaction } from "./sql";

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

function freshDb(): Database {
  const db = new SQL.Database();
  migrate(db);
  return db;
}
const cat = (db: Database, name: string) => listCategories(db).find((c) => c.name === name)!;

describe("schema + migrations", () => {
  it("creates the schema, seeds categories and records the version", () => {
    const db = freshDb();
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(listCategories(db)).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(query<{ foreign_keys: number }>(db, "PRAGMA foreign_keys")[0].foreign_keys).toBe(1);
  });
  it("is idempotent", () => {
    const db = freshDb();
    expect(migrate(db)).toEqual({ from: LATEST_SCHEMA_VERSION, to: LATEST_SCHEMA_VERSION });
    expect(listCategories(db)).toHaveLength(DEFAULT_CATEGORIES.length);
  });
  it("refuses a database saved by a newer app", () => {
    const db = freshDb();
    db.run(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    expect(() => migrate(db)).toThrow(FutureSchemaError);
  });
  it("survives export → reopen", () => {
    const db = freshDb();
    addTransaction(db, { kind: "expense", amountMinor: 1234, categoryId: cat(db, "Shopping").id, occurredOn: "2026-11-01" });
    const reopened = new SQL.Database(db.export());
    expect(migrate(reopened).from).toBe(LATEST_SCHEMA_VERSION);
    expect(listTransactions(reopened)).toHaveLength(1);
  });
});

describe("constraints enforced by the database itself", () => {
  it("rejects bad rows even when the repo is bypassed", () => {
    const db = freshDb();
    const id = cat(db, "Shopping").id;
    const bad = (sql: string, params: (string | number)[]) => expect(() => db.run(sql, params)).toThrow();
    bad("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('expense', 0, ?, '2026-01-01', 'x')", [id]);
    bad("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('expense', -5, ?, '2026-01-01', 'x')", [id]);
    bad("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('transfer', 5, ?, '2026-01-01', 'x')", [id]);
    bad("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('expense', 5, ?, '01/02/2026', 'x')", [id]);
    bad("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('expense', 5, 9999, '2026-01-01', 'x')", []);
    bad("INSERT INTO categories (name, icon, color, kind) VALUES ('x', 'Tag', 'red', 'expense')", []);
  });
});

describe("transactions", () => {
  it("adds, lists newest-first, updates and deletes", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const a = addTransaction(db, { kind: "expense", amountMinor: 5000, categoryId: food, note: "  lunch ", occurredOn: "2026-11-01" });
    const b = addTransaction(db, { kind: "expense", amountMinor: 7000, categoryId: food, occurredOn: "2026-11-03" });
    expect(a.note).toBe("lunch");
    expect(listTransactions(db).map((t) => t.id)).toEqual([b.id, a.id]);

    const edited = updateTransaction(db, a.id, { amountMinor: 5500, note: "late lunch" });
    expect(edited).toMatchObject({ amountMinor: 5500, note: "late lunch", occurredOn: "2026-11-01" });
    expect(deleteTransactions(db, [a.id, b.id])).toBe(2);
    expect(listTransactions(db)).toHaveLength(0);
  });

  it("validates input with readable messages", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const salary = cat(db, "Salary").id;
    expect(() => addTransaction(db, { kind: "expense", amountMinor: 0, categoryId: food, occurredOn: "2026-11-01" })).toThrow("Amount must be greater than zero");
    expect(() => addTransaction(db, { kind: "expense", amountMinor: 1.5, categoryId: food, occurredOn: "2026-11-01" })).toThrow(ValidationError);
    expect(() => addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: food, occurredOn: "2026-02-30" })).toThrow("Enter a valid date");
    expect(() => addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: salary, occurredOn: "2026-11-01" })).toThrow("income category");
    expect(() => addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: 9999, occurredOn: "2026-11-01" })).toThrow("Choose a category");
  });

  it("filters by range, kind, category and search (with LIKE wildcards escaped)", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const salary = cat(db, "Salary").id;
    addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: food, note: "100% organic", occurredOn: "2026-10-31" });
    addTransaction(db, { kind: "expense", amountMinor: 200, categoryId: food, note: "plain", occurredOn: "2026-11-02" });
    addTransaction(db, { kind: "income", amountMinor: 900, categoryId: salary, occurredOn: "2026-11-05" });
    expect(listTransactions(db, { from: "2026-11-01", to: "2026-11-30" })).toHaveLength(2);
    expect(listTransactions(db, { kind: "income" })).toHaveLength(1);
    expect(listTransactions(db, { categoryId: food })).toHaveLength(2);
    expect(listTransactions(db, { search: "100%" })).toHaveLength(1);
    expect(listTransactions(db, { search: "%" })).toHaveLength(1); // matches only the literal %
    expect(listTransactions(db, { search: "' OR 1=1 --" })).toHaveLength(0);
  });

  it("treats hostile text as data (injection attempt stays in the note)", () => {
    const db = freshDb();
    const nasty = "x'); DROP TABLE transactions; --";
    addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: cat(db, "Shopping").id, note: nasty, occurredOn: "2026-11-01" });
    expect(listTransactions(db)[0].note).toBe(nasty);
    expect(query(db, "SELECT name FROM sqlite_master WHERE name = 'transactions'")).toHaveLength(1);
  });

  it("ignores unknown keys on update (no identifier injection)", () => {
    const db = freshDb();
    const t = addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: cat(db, "Shopping").id, occurredOn: "2026-11-01" });
    const patched = updateTransaction(db, t.id, { note: "ok", ["id = 99, note"]: "hax" } as never);
    expect(patched.id).toBe(t.id);
    expect(patched.note).toBe("ok");
  });

  it("nests: an inner failure rolls back only the inner work, an outer failure rolls back everything", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const add = (note: string) => addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: food, note, occurredOn: "2026-11-01" });
    withTransaction(db, () => {
      add("outer-1");
      expect(() => withTransaction(db, () => { add("inner"); throw new Error("inner fails"); })).toThrow("inner fails");
      add("outer-2");
    });
    expect(listTransactions(db).map((t) => t.note).sort()).toEqual(["outer-1", "outer-2"]);
    expect(() => withTransaction(db, () => { add("x"); withTransaction(db, () => add("y")); throw new Error("outer fails"); })).toThrow();
    expect(listTransactions(db)).toHaveLength(2);
    // deleteTransactions/restoreTransactions/mergeCategories open their own transaction: they must compose too.
    withTransaction(db, () => { deleteTransactions(db, listTransactions(db).map((t) => t.id)); });
    expect(listTransactions(db)).toHaveLength(0);
  });

  it("restores deleted entries with their original ids (Undo)", () => {
    const db = freshDb();
    const t = addTransaction(db, { kind: "expense", amountMinor: 900, categoryId: cat(db, "Shopping").id, note: "shoes", occurredOn: "2026-11-01" });
    const snapshot = listTransactions(db);
    deleteTransactions(db, [t.id]);
    expect(listTransactions(db)).toHaveLength(0);
    withTransaction(db, () => restoreTransactions(db, snapshot));
    expect(listTransactions(db)).toEqual(snapshot);
  });

  it("rolls back a failed transaction completely", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    expect(() =>
      withTransaction(db, () => {
        addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: food, occurredOn: "2026-11-01" });
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(listTransactions(db)).toHaveLength(0);
  });
});

describe("categories", () => {
  it("adds with duplicate protection and renames", () => {
    const db = freshDb();
    const created = addCategory(db, { name: "Pets", color: "#112233", kind: "expense" });
    expect(created.icon).toBe("Tag");
    expect(() => addCategory(db, { name: "Pets", color: "#112233", kind: "expense" })).toThrow("already have");
    expect(() => addCategory(db, { name: "Pets", color: "nope", kind: "expense" })).toThrow("hex");
    expect(updateCategory(db, created.id, { name: "Pet care" }).name).toBe("Pet care");
  });

  it("archives categories used by entries and refuses to delete them", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining");
    addTransaction(db, { kind: "expense", amountMinor: 100, categoryId: food.id, occurredOn: "2026-11-01" });
    expect(countCategoryUsage(db, food.id)).toBe(1);
    expect(() => deleteCategory(db, food.id)).toThrow("Archive it");
    setCategoryArchived(db, food.id, true);
    expect(listCategories(db).some((c) => c.id === food.id)).toBe(false);
    expect(listCategories(db, { includeArchived: true }).some((c) => c.id === food.id)).toBe(true);
    const unused = addCategory(db, { name: "Temp", color: "#000000", kind: "expense" });
    expect(() => deleteCategory(db, unused.id)).not.toThrow();
  });

  it("merges entries and budgets into the target category", () => {
    const db = freshDb();
    const a = addCategory(db, { name: "Snacks", color: "#112233", kind: "expense" });
    const b = cat(db, "Food & Dining");
    addTransaction(db, { kind: "expense", amountMinor: 300, categoryId: a.id, occurredOn: "2026-11-01" });
    upsertBudget(db, { categoryId: a.id, amountMinor: 1000, period: "monthly" });
    upsertBudget(db, { categoryId: b.id, amountMinor: 9000, period: "monthly" });
    upsertBudget(db, { categoryId: a.id, amountMinor: 500, period: "weekly" });
    mergeCategories(db, a.id, b.id);
    expect(listTransactions(db, { categoryId: b.id })).toHaveLength(1);
    const budgets = listBudgets(db).filter((x) => x.categoryId === b.id);
    expect(budgets.map((x) => x.period).sort()).toEqual(["monthly", "weekly"]);
    expect(budgets.find((x) => x.period === "monthly")!.amountMinor).toBe(9000); // target's own kept
    expect(() => mergeCategories(db, b.id, cat(db, "Salary").id)).toThrow("same type");
  });
});

describe("budgets + stats", () => {
  it("upserts one budget per category+period and only for expense categories", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    upsertBudget(db, { categoryId: food, amountMinor: 1000, period: "monthly" });
    upsertBudget(db, { categoryId: food, amountMinor: 2000, period: "monthly" });
    expect(listBudgets(db)).toHaveLength(1);
    expect(listBudgets(db)[0].amountMinor).toBe(2000);
    expect(() => upsertBudget(db, { categoryId: cat(db, "Salary").id, amountMinor: 1, period: "monthly" })).toThrow("expense");
  });

  it("budget progress respects the period (BUG-3) and status thresholds", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const today = "2026-11-11"; // Wednesday; week = Sat 7 Nov .. Fri 13 Nov
    addTransaction(db, { kind: "expense", amountMinor: 5000, categoryId: food, occurredOn: "2026-11-09" }); // this week
    addTransaction(db, { kind: "expense", amountMinor: 3000, categoryId: food, occurredOn: "2026-11-02" }); // this month, not this week
    addTransaction(db, { kind: "expense", amountMinor: 9000, categoryId: food, occurredOn: "2026-10-20" }); // last month
    const txns = listTransactions(db);
    const weekly = budgetProgress(upsertBudget(db, { categoryId: food, amountMinor: 5000, period: "weekly" }), txns, today);
    const monthly = budgetProgress(upsertBudget(db, { categoryId: food, amountMinor: 10000, period: "monthly" }), txns, today);
    const yearly = budgetProgress(upsertBudget(db, { categoryId: food, amountMinor: 100000, period: "yearly" }), txns, today);
    expect(weekly).toMatchObject({ spentMinor: 5000, status: "over", remainingMinor: 0 });
    expect(monthly).toMatchObject({ spentMinor: 8000, status: "near" });
    expect(yearly).toMatchObject({ spentMinor: 17000, status: "ok" });
  });

  it("computes stats with integer math and honest edge cases", () => {
    const db = freshDb();
    const food = cat(db, "Food & Dining").id;
    const salary = cat(db, "Salary").id;
    const today = "2026-11-11";
    expect(computeStats([], today)).toMatchObject({ balanceMinor: 0, savingsRatePct: null, expenseChangePct: null });
    addTransaction(db, { kind: "income", amountMinor: 100000, categoryId: salary, occurredOn: "2026-11-01" });
    addTransaction(db, { kind: "expense", amountMinor: 25000, categoryId: food, occurredOn: "2026-11-05" });
    addTransaction(db, { kind: "expense", amountMinor: 20000, categoryId: food, occurredOn: "2026-10-05" });
    addTransaction(db, { kind: "expense", amountMinor: 1, categoryId: food, occurredOn: "2026-05-31" }); // outside 6-month window
    const s = computeStats(listTransactions(db), today);
    expect(s.balanceMinor).toBe(100000 - 25000 - 20000 - 1);
    expect(s.monthExpenseMinor).toBe(25000);
    expect(s.savingsRatePct).toBe(75);
    expect(s.expenseChangePct).toBe(25);
    expect(s.expenseByCategory.get(food)).toBe(25000);
    expect(s.trend).toHaveLength(6);
    expect(s.trend.map((p) => p.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(s.trend[5]).toMatchObject({ incomeMinor: 100000, expenseMinor: 25000 });
    expect(s.trend[4].expenseMinor).toBe(20000);
  });

  it("stores simple settings in meta", () => {
    const db = freshDb();
    expect(getMeta(db, "currency")).toBeNull();
    setMeta(db, "currency", "BDT");
    setMeta(db, "currency", "USD");
    expect(getMeta(db, "currency")).toBe("USD");
  });
});
