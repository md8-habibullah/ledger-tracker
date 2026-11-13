import type { Budget, Category, Kind, Period, Transaction } from "@/db/repo";
import { CATEGORY_COLORS } from "./icons";
import { currentCategoryColor } from "./legacyCategoryColors";

/**
 * Import = (1) read a file into an ImportSource, (2) plan it against what the vault already holds,
 * (3) apply the plan in one transaction (src/db/importer.ts). This file is step 2 and touches no database,
 * so the preview a person sees and the write that follows come from the same pure function.
 */

export interface ImportEntry {
  /** Spreadsheet row the entry came from (CSV only), for messages. */
  row?: number;
  kind: Kind;
  categoryName: string;
  amountMinor: number;
  note: string;
  occurredOn: string;
}
export interface ImportCategory {
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  archived: boolean;
}
export interface ImportBudget {
  categoryName: string;
  period: Period;
  amountMinor: number;
}
/** What a file contains. Entries are listed newest first, the order the app itself exports them in. */
export interface ImportSource {
  /** Currency the file says its amounts are in, when it says. */
  currency: string | null;
  categories: ImportCategory[];
  entries: ImportEntry[];
  budgets: ImportBudget[];
}

export interface ExistingLedger {
  categories: readonly Category[];
  transactions: readonly Transaction[];
  budgets: readonly Budget[];
}

/** An existing category (by id) or one the import will create (by key). */
export type CategoryRef = { id: number } | { key: string };
export type PlannedCategory = ImportCategory & { key: string };
export interface PlannedEntry {
  ref: CategoryRef;
  kind: Kind;
  amountMinor: number;
  note: string;
  occurredOn: string;
}
export interface PlannedBudget {
  ref: CategoryRef;
  period: Period;
  amountMinor: number;
}

export interface ImportPlan {
  /** Categories to create first. */
  newCategories: PlannedCategory[];
  /** Entries to insert, in insertion order (see planImport). */
  entries: PlannedEntry[];
  /** Entries left out because the vault already has them. */
  duplicates: number;
  budgets: PlannedBudget[];
  /** Budgets left alone because the vault already has one for that category and period. */
  budgetsKept: number;
  totals: { income: number; expense: number };
  /** Oldest and newest date among the entries to insert, or null when there are none. */
  dateRange: { from: string; to: string } | null;
}

const categoryKey = (kind: Kind, name: string) => `${kind}|${name.trim().toLowerCase()}`;
const entryKey = (date: string, kind: Kind, categoryId: number, amountMinor: number, note: string) =>
  [date, kind, categoryId, amountMinor, note].join("\u0000");

function pickCategory(candidates: readonly Category[], name: string): Category {
  return (
    candidates.find((c) => c.name === name && !c.archived) ??
    candidates.find((c) => c.name === name) ??
    candidates.find((c) => !c.archived) ??
    candidates[0]
  );
}

/**
 * Decide what an import would do. Categories match by type and name, ignoring case; a name nobody has yet
 * becomes a new category (CSV files: a tag icon and the next swatch of the palette; backups: their own icon
 * and colour). With `skipDuplicates`, an entry is left out when the vault already has an identical one (same
 * day, type, category, amount and note) - counted one for one, so two identical coffees on a day are two
 * entries, and importing a file twice adds nothing the second time.
 *
 * Entries are planned in reverse file order. The app lists entries newest first (day, then newest saved), so
 * saving them oldest first gives an exported file back in exactly the order it was written in.
 */
export function planImport(source: ImportSource, existing: ExistingLedger, options: { skipDuplicates: boolean }): ImportPlan {
  const byKey = new Map<string, Category[]>();
  for (const c of existing.categories) {
    const key = categoryKey(c.kind, c.name);
    const list = byKey.get(key);
    if (list) list.push(c);
    else byKey.set(key, [c]);
  }
  const meta = new Map(source.categories.map((c) => [categoryKey(c.kind, c.name), c]));
  const created = new Map<string, PlannedCategory>();

  const resolve = (kind: Kind, rawName: string): CategoryRef => {
    const name = rawName.trim();
    const key = categoryKey(kind, name);
    const found = byKey.get(key);
    if (found) return { id: pickCategory(found, name).id };
    if (!created.has(key)) {
      const from = meta.get(key);
      created.set(key, {
        key,
        name,
        kind,
        icon: from?.icon ?? "Tag",
        color: from ? currentCategoryColor(from.color) : CATEGORY_COLORS[(existing.categories.length + created.size) % CATEGORY_COLORS.length],
        archived: from?.archived ?? false,
      });
    }
    return { key };
  };

  // Categories a backup carries even when no entry uses them (custom ones, with their icon and colour).
  for (const c of source.categories) if (!c.archived) resolve(c.kind, c.name);

  const remaining = new Map<string, number>();
  if (options.skipDuplicates) {
    for (const t of existing.transactions) {
      const key = entryKey(t.occurredOn, t.kind, t.categoryId, t.amountMinor, t.note);
      remaining.set(key, (remaining.get(key) ?? 0) + 1);
    }
  }

  const entries: PlannedEntry[] = [];
  let duplicates = 0;
  const totals = { income: 0, expense: 0 };
  let from = "";
  let to = "";
  for (const e of source.entries) {
    const note = e.note.trim();
    const ref = resolve(e.kind, e.categoryName);
    if (options.skipDuplicates && "id" in ref) {
      const key = entryKey(e.occurredOn, e.kind, ref.id, e.amountMinor, note);
      const left = remaining.get(key) ?? 0;
      if (left > 0) {
        remaining.set(key, left - 1);
        duplicates++;
        continue;
      }
    }
    entries.push({ ref, kind: e.kind, amountMinor: e.amountMinor, note, occurredOn: e.occurredOn });
    totals[e.kind] += e.amountMinor;
    if (!from || e.occurredOn < from) from = e.occurredOn;
    if (!to || e.occurredOn > to) to = e.occurredOn;
  }
  entries.reverse();

  const haveBudget = new Set(existing.budgets.map((b) => `${b.categoryId}|${b.period}`));
  const budgets: PlannedBudget[] = [];
  let budgetsKept = 0;
  for (const b of source.budgets) {
    const ref = resolve("expense", b.categoryName);
    if ("id" in ref && haveBudget.has(`${ref.id}|${b.period}`)) {
      budgetsKept++;
      continue;
    }
    budgets.push({ ref, period: b.period, amountMinor: b.amountMinor });
  }

  return {
    newCategories: [...created.values()],
    entries,
    duplicates,
    budgets,
    budgetsKept,
    totals,
    dateRange: from ? { from, to } : null,
  };
}

/** True when applying the plan would change nothing. */
export function isEmptyPlan(plan: ImportPlan): boolean {
  return plan.entries.length === 0 && plan.budgets.length === 0 && plan.newCategories.length === 0;
}
