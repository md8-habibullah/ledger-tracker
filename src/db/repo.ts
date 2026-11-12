import { z } from "zod";
import { MAX_MINOR } from "@/lib/money";
import { isDateString } from "@/lib/dates";
import { type Database, escapeLike, lastInsertId, query, queryOne, run, withTransaction } from "./sql";

/**
 * Repositories: every statement uses bound parameters, column names come from fixed
 * maps (never from input), and every write is validated with zod first. There is no
 * user_id: a vault holds exactly one person's data.
 * Callers MUST persist afterwards (VaultService.save()).
 */

export type Kind = "income" | "expense";
export type Period = "weekly" | "monthly" | "yearly";

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  kind: Kind;
  archived: boolean;
}
export interface Transaction {
  id: number;
  kind: Kind;
  amountMinor: number;
  categoryId: number;
  note: string;
  occurredOn: string;
  createdAt: string;
}
export interface Budget {
  id: number;
  categoryId: number;
  amountMinor: number;
  period: Period;
  createdAt: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function parse<Output, Input>(schema: z.ZodType<Output, z.ZodTypeDef, Input>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

// ------------------------------------------------------------------ schemas

const kindSchema = z.enum(["income", "expense"], { errorMap: () => ({ message: "Choose income or expense" }) });
const periodSchema = z.enum(["weekly", "monthly", "yearly"], { errorMap: () => ({ message: "Choose a budget period" }) });
const idSchema = z.number().int().positive();
const minorSchema = z
  .number({ invalid_type_error: "Enter an amount" })
  .int("Amount must be a whole number of minor units")
  .positive("Amount must be greater than zero")
  .max(MAX_MINOR, "That amount is too large");
const dateSchema = z.string().refine(isDateString, "Enter a valid date");
const noteSchema = z.string().trim().max(500, "Keep the note under 500 characters");
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #5A5DA9");

export const transactionInputSchema = z.object({
  kind: kindSchema,
  amountMinor: minorSchema,
  categoryId: idSchema,
  note: noteSchema.default(""),
  occurredOn: dateSchema,
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

export const transactionPatchSchema = transactionInputSchema.partial();
export type TransactionPatch = z.input<typeof transactionPatchSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Keep the name under 60 characters"),
  icon: z.string().trim().min(1).max(40).default("Tag"),
  color: colorSchema,
  kind: kindSchema,
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const budgetInputSchema = z.object({
  categoryId: idSchema,
  amountMinor: minorSchema,
  period: periodSchema,
});
export type BudgetInput = z.input<typeof budgetInputSchema>;

// ------------------------------------------------------------------ row mapping

interface CategoryRow { id: number; name: string; icon: string; color: string; kind: Kind; archived: number }
interface TransactionRow {
  id: number; kind: Kind; amount_minor: number; category_id: number;
  note: string; occurred_on: string; created_at: string;
}
interface BudgetRow { id: number; category_id: number; amount_minor: number; period: Period; created_at: string }

const toCategory = (r: CategoryRow): Category => ({
  id: Number(r.id), name: r.name, icon: r.icon, color: r.color, kind: r.kind, archived: Number(r.archived) === 1,
});
const toTransaction = (r: TransactionRow): Transaction => ({
  id: Number(r.id), kind: r.kind, amountMinor: Number(r.amount_minor), categoryId: Number(r.category_id),
  note: r.note, occurredOn: r.occurred_on, createdAt: r.created_at,
});
const toBudget = (r: BudgetRow): Budget => ({
  id: Number(r.id), categoryId: Number(r.category_id), amountMinor: Number(r.amount_minor),
  period: r.period, createdAt: r.created_at,
});

// ------------------------------------------------------------------ meta

export function getMeta(db: Database, key: string): string | null {
  return queryOne<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", [key])?.value ?? null;
}
export function setMeta(db: Database, key: string, value: string): void {
  run(db, "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

// ------------------------------------------------------------------ categories

export function listCategories(db: Database, options: { includeArchived?: boolean } = {}): Category[] {
  const where = options.includeArchived ? "" : "WHERE archived = 0";
  return query<CategoryRow>(db, `SELECT id, name, icon, color, kind, archived FROM categories ${where} ORDER BY kind DESC, name COLLATE NOCASE`).map(toCategory);
}

function uniqueCategoryViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed: categories/i.test(error.message);
}

export function addCategory(db: Database, input: CategoryInput): Category {
  const data = parse(categoryInputSchema, input);
  try {
    run(db, "INSERT INTO categories (name, icon, color, kind) VALUES (?, ?, ?, ?)", [data.name, data.icon, data.color, data.kind]);
  } catch (error) {
    if (uniqueCategoryViolation(error)) throw new ValidationError(`You already have a ${data.kind} category called “${data.name}”`);
    throw error;
  }
  return getCategory(db, lastInsertId(db))!;
}

export function getCategory(db: Database, id: number): Category | undefined {
  const row = queryOne<CategoryRow>(db, "SELECT id, name, icon, color, kind, archived FROM categories WHERE id = ?", [id]);
  return row ? toCategory(row) : undefined;
}

export function updateCategory(db: Database, id: number, patch: Partial<Pick<CategoryInput, "name" | "icon" | "color">>): Category {
  const existing = getCategory(db, parse(idSchema, id));
  if (!existing) throw new ValidationError("That category no longer exists");
  const data = parse(categoryInputSchema.pick({ name: true, icon: true, color: true }), {
    name: patch.name ?? existing.name,
    icon: patch.icon ?? existing.icon,
    color: patch.color ?? existing.color,
  });
  try {
    run(db, "UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?", [data.name, data.icon, data.color, id]);
  } catch (error) {
    if (uniqueCategoryViolation(error)) throw new ValidationError(`You already have a ${existing.kind} category called “${data.name}”`);
    throw error;
  }
  return getCategory(db, id)!;
}

export function setCategoryArchived(db: Database, id: number, archived: boolean): void {
  run(db, "UPDATE categories SET archived = ? WHERE id = ?", [archived ? 1 : 0, parse(idSchema, id)]);
}

/** Entries recorded against a category (used to decide between delete and archive). */
export function countCategoryUsage(db: Database, id: number): number {
  return Number(queryOne<{ n: number }>(db, "SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?", [id])?.n ?? 0);
}

/** Delete an unused category; refuses when entries exist (archive it instead). */
export function deleteCategory(db: Database, id: number): void {
  if (countCategoryUsage(db, id) > 0) throw new ValidationError("This category has entries. Archive it instead of deleting.");
  run(db, "DELETE FROM categories WHERE id = ?", [id]);
}

/** Move every entry (and budget) from one category to another of the same kind, then delete the source. */
export function mergeCategories(db: Database, fromId: number, intoId: number): void {
  if (fromId === intoId) throw new ValidationError("Pick two different categories");
  const from = getCategory(db, fromId);
  const into = getCategory(db, intoId);
  if (!from || !into) throw new ValidationError("That category no longer exists");
  if (from.kind !== into.kind) throw new ValidationError("You can only merge categories of the same type");
  withTransaction(db, () => {
    run(db, "UPDATE transactions SET category_id = ? WHERE category_id = ?", [intoId, fromId]);
    // A budget on the source is dropped if the target already has one for that period.
    run(db, "DELETE FROM budgets WHERE category_id = ? AND period IN (SELECT period FROM budgets WHERE category_id = ?)", [fromId, intoId]);
    run(db, "UPDATE budgets SET category_id = ? WHERE category_id = ?", [intoId, fromId]);
    run(db, "DELETE FROM categories WHERE id = ?", [fromId]);
  });
}

// ------------------------------------------------------------------ transactions

export interface TransactionFilter {
  from?: string;
  to?: string;
  kind?: Kind;
  categoryId?: number;
  search?: string;
}

export function listTransactions(db: Database, filter: TransactionFilter = {}): Transaction[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.from) { where.push("occurred_on >= ?"); params.push(parse(dateSchema, filter.from)); }
  if (filter.to) { where.push("occurred_on <= ?"); params.push(parse(dateSchema, filter.to)); }
  if (filter.kind) { where.push("kind = ?"); params.push(parse(kindSchema, filter.kind)); }
  if (filter.categoryId !== undefined) { where.push("category_id = ?"); params.push(parse(idSchema, filter.categoryId)); }
  if (filter.search?.trim()) { where.push("note LIKE ? ESCAPE '\\'"); params.push(`%${escapeLike(filter.search.trim())}%`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query<TransactionRow>(
    db,
    `SELECT id, kind, amount_minor, category_id, note, occurred_on, created_at FROM transactions ${clause} ORDER BY occurred_on DESC, id DESC`,
    params,
  ).map(toTransaction);
}

export function getTransaction(db: Database, id: number): Transaction | undefined {
  const row = queryOne<TransactionRow>(
    db,
    "SELECT id, kind, amount_minor, category_id, note, occurred_on, created_at FROM transactions WHERE id = ?",
    [id],
  );
  return row ? toTransaction(row) : undefined;
}

function assertCategoryFits(db: Database, categoryId: number, kind: Kind): void {
  const category = getCategory(db, categoryId);
  if (!category) throw new ValidationError("Choose a category");
  if (category.kind !== kind) throw new ValidationError(`“${category.name}” is a ${category.kind} category`);
}

export function addTransaction(db: Database, input: TransactionInput, now: Date = new Date()): Transaction {
  const data = parse(transactionInputSchema, input);
  assertCategoryFits(db, data.categoryId, data.kind);
  run(
    db,
    "INSERT INTO transactions (kind, amount_minor, category_id, note, occurred_on, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [data.kind, data.amountMinor, data.categoryId, data.note, data.occurredOn, now.toISOString()],
  );
  return getTransaction(db, lastInsertId(db))!;
}

const TRANSACTION_COLUMNS = {
  kind: "kind",
  amountMinor: "amount_minor",
  categoryId: "category_id",
  note: "note",
  occurredOn: "occurred_on",
} as const;

export function updateTransaction(db: Database, id: number, patch: TransactionPatch): Transaction {
  const existing = getTransaction(db, parse(idSchema, id));
  if (!existing) throw new ValidationError("That entry no longer exists");
  const data = parse(transactionPatchSchema, patch);
  const merged = { ...existing, ...data };
  assertCategoryFits(db, merged.categoryId, merged.kind);
  const sets: string[] = [];
  const params: (string | number)[] = [];
  for (const key of Object.keys(TRANSACTION_COLUMNS) as (keyof typeof TRANSACTION_COLUMNS)[]) {
    if (data[key] !== undefined) {
      sets.push(`${TRANSACTION_COLUMNS[key]} = ?`);
      params.push(data[key] as string | number);
    }
  }
  if (sets.length > 0) run(db, `UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  return getTransaction(db, id)!;
}

/** Put back entries removed by deleteTransactions (Undo). Keeps their original ids and timestamps. */
export function restoreTransactions(db: Database, rows: readonly Transaction[]): void {
  withTransaction(db, () => {
    for (const t of rows) {
      const data = parse(transactionInputSchema, { kind: t.kind, amountMinor: t.amountMinor, categoryId: t.categoryId, note: t.note, occurredOn: t.occurredOn });
      run(
        db,
        "INSERT OR REPLACE INTO transactions (id, kind, amount_minor, category_id, note, occurred_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [parse(idSchema, t.id), data.kind, data.amountMinor, data.categoryId, data.note, data.occurredOn, t.createdAt],
      );
    }
  });
}

export function deleteTransactions(db: Database, ids: number[]): number {
  const clean = ids.map((id) => parse(idSchema, id));
  if (clean.length === 0) return 0;
  return withTransaction(db, () => {
    let removed = 0;
    for (let i = 0; i < clean.length; i += 500) {
      const chunk = clean.slice(i, i + 500);
      removed += run(db, `DELETE FROM transactions WHERE id IN (${chunk.map(() => "?").join(",")})`, chunk);
    }
    return removed;
  });
}

// ------------------------------------------------------------------ budgets

export function listBudgets(db: Database): Budget[] {
  return query<BudgetRow>(db, "SELECT id, category_id, amount_minor, period, created_at FROM budgets ORDER BY id").map(toBudget);
}

/** One budget per category and period: saving again replaces the amount. */
export function upsertBudget(db: Database, input: BudgetInput, now: Date = new Date()): Budget {
  const data = parse(budgetInputSchema, input);
  const category = getCategory(db, data.categoryId);
  if (!category) throw new ValidationError("Choose a category");
  if (category.kind !== "expense") throw new ValidationError("Budgets apply to expense categories");
  run(
    db,
    `INSERT INTO budgets (category_id, amount_minor, period, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(category_id, period) DO UPDATE SET amount_minor = excluded.amount_minor`,
    [data.categoryId, data.amountMinor, data.period, now.toISOString()],
  );
  const row = queryOne<BudgetRow>(
    db,
    "SELECT id, category_id, amount_minor, period, created_at FROM budgets WHERE category_id = ? AND period = ?",
    [data.categoryId, data.period],
  )!;
  return toBudget(row);
}

export function deleteBudget(db: Database, id: number): void {
  run(db, "DELETE FROM budgets WHERE id = ?", [parse(idSchema, id)]);
}
