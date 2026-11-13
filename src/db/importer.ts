import type { ZodType, ZodTypeDef } from "zod";
import type { ImportBudget, ImportCategory, ImportEntry, ImportPlan, ImportSource } from "@/lib/importPlan";
import {
  ValidationError, addCategory, budgetInputSchema, deleteBudget, deleteCategory, deleteTransactions, getMeta, listBudgets, listCategories,
  listTransactions, setCategoryArchived, transactionInputSchema,
} from "./repo";
import { type Database, lastInsertId, query, run, withTransaction } from "./sql";

/** Everything an import added, so Undo can take exactly that back and nothing else. */
export interface ImportResult {
  categoryIds: number[];
  transactionIds: number[];
  budgetIds: number[];
}

/** Read a whole vault (a decrypted backup) into the shape the importer works with. Entries come newest first. */
export function readImportSource(db: Database): ImportSource {
  const categories = listCategories(db, { includeArchived: true });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const entries: ImportEntry[] = [];
  for (const t of listTransactions(db)) {
    const category = byId.get(t.categoryId);
    if (category) entries.push({ kind: t.kind, categoryName: category.name, amountMinor: t.amountMinor, note: t.note, occurredOn: t.occurredOn });
  }
  const budgets: ImportBudget[] = [];
  for (const b of listBudgets(db)) {
    const category = byId.get(b.categoryId);
    if (category) budgets.push({ categoryName: category.name, period: b.period, amountMinor: b.amountMinor });
  }
  return {
    currency: getMeta(db, "currency"),
    categories: categories.map<ImportCategory>((c) => ({ name: c.name, kind: c.kind, icon: c.icon, color: c.color, archived: c.archived })),
    entries,
    budgets,
  };
}

function checked<Output, Input>(schema: ZodType<Output, ZodTypeDef, Input>, value: unknown): Output {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

/**
 * Write a plan: new categories first, then entries and budgets, all inside one transaction (a failure anywhere
 * leaves the vault exactly as it was). Every value is validated again here with the same schemas the forms use.
 * The caller persists afterwards (useMutate does).
 */
export function applyImport(db: Database, plan: ImportPlan, now: Date = new Date()): ImportResult {
  return withTransaction(db, () => {
    const result: ImportResult = { categoryIds: [], transactionIds: [], budgetIds: [] };
    const created = new Map<string, number>();
    for (const c of plan.newCategories) {
      const made = addCategory(db, { name: c.name, icon: c.icon, color: c.color, kind: c.kind });
      if (c.archived) setCategoryArchived(db, made.id, true);
      created.set(c.key, made.id);
      result.categoryIds.push(made.id);
    }
    const idOf = (ref: { id: number } | { key: string }): number => {
      const id = "id" in ref ? ref.id : created.get(ref.key);
      if (id === undefined) throw new ValidationError("An entry refers to a category that could not be created");
      return id;
    };

    // Kind and existence are checked against the database, so an entry can never land in a category of the other type.
    const kindOf = new Map(query<{ id: number; kind: string }>(db, "SELECT id, kind FROM categories").map((r) => [Number(r.id), r.kind]));
    const createdAt = now.toISOString();
    const insert = db.prepare("INSERT INTO transactions (kind, amount_minor, category_id, note, occurred_on, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    try {
      for (const e of plan.entries) {
        const categoryId = idOf(e.ref);
        if (kindOf.get(categoryId) !== e.kind) throw new ValidationError("An entry does not match the type of its category");
        const data = checked(transactionInputSchema, { kind: e.kind, amountMinor: e.amountMinor, categoryId, note: e.note, occurredOn: e.occurredOn });
        insert.run([data.kind, data.amountMinor, data.categoryId, data.note, data.occurredOn, createdAt]);
        result.transactionIds.push(lastInsertId(db));
      }
    } finally {
      insert.free();
    }

    for (const b of plan.budgets) {
      const categoryId = idOf(b.ref);
      if (kindOf.get(categoryId) !== "expense") throw new ValidationError("A budget does not belong to an expense category");
      const data = checked(budgetInputSchema, { categoryId, amountMinor: b.amountMinor, period: b.period });
      const changed = run(
        db,
        "INSERT INTO budgets (category_id, amount_minor, period, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(category_id, period) DO NOTHING",
        [data.categoryId, data.amountMinor, data.period, createdAt],
      );
      if (changed === 1) result.budgetIds.push(lastInsertId(db));
    }
    return result;
  });
}

/**
 * Take back what applyImport added. Categories it created stay if anything has used them since
 * (an entry or a budget), so Undo never removes something the person built on top of the import.
 */
export function undoImport(db: Database, result: ImportResult): void {
  withTransaction(db, () => {
    deleteTransactions(db, result.transactionIds);
    for (const id of result.budgetIds) deleteBudget(db, id);
    for (const id of result.categoryIds) {
      const budgets = Number(query<{ n: number }>(db, "SELECT COUNT(*) AS n FROM budgets WHERE category_id = ?", [id])[0]?.n ?? 0);
      if (budgets > 0) continue;
      try {
        deleteCategory(db, id); // refuses while entries still use it
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
      }
    }
  });
}
