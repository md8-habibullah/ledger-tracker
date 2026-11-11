import { type Database, type SqlJsStatic, query } from "@/db/sql";
import { type Kind, ValidationError, addCategory, getCategory, listCategories, upsertBudget } from "@/db/repo";
import { normaliseLegacyDate, todayLocal } from "@/lib/dates";
import { MAX_MINOR } from "@/lib/money";

/**
 * One-way import from the pre-encryption app (plaintext SQLite file, REAL amounts,
 * category stored by name, many users in one file). Never reads or copies `password`.
 */

const SQLITE_HEADER = "SQLite format 3\0";

export function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  for (let i = 0; i < SQLITE_HEADER.length; i++) if (bytes[i] !== SQLITE_HEADER.charCodeAt(i)) return false;
  return true;
}

export interface LegacyUser {
  id: number;
  username: string;
  transactionCount: number;
  budgetCount: number;
}

export interface LegacyReport {
  transactions: number;
  budgets: number;
  categoriesAdded: number;
  skipped: { reason: string; count: number }[];
  /** Σ round(amount × 100) of the rows we imported — compared against the new vault to prove nothing was lost. */
  importedMinor: { income: number; expense: number };
}

function hasTable(db: Database, name: string): boolean {
  return query(db, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [name]).length > 0;
}

export function listLegacyUsers(sql: SqlJsStatic, bytes: Uint8Array): LegacyUser[] {
  if (!isSqliteFile(bytes)) return [];
  const legacy = new sql.Database(bytes);
  try {
    if (!hasTable(legacy, "users")) return [];
    const users = query<{ id: number; username: string }>(legacy, "SELECT id, username FROM users ORDER BY id");
    const COUNT_SQL = {
      transactions: "SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?",
      budgets: "SELECT COUNT(*) AS n FROM budgets WHERE user_id = ?",
    } as const;
    const count = (table: keyof typeof COUNT_SQL, userId: number) =>
      hasTable(legacy, table) ? Number(query<{ n: number }>(legacy, COUNT_SQL[table], [userId])[0].n) : 0;
    return users.map((u) => ({
      id: Number(u.id),
      username: String(u.username),
      transactionCount: count("transactions", Number(u.id)),
      budgetCount: count("budgets", Number(u.id)),
    }));
  } finally {
    legacy.close();
  }
}

function toMinor(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const minor = Math.round(n * 100);
  return minor > 0 && minor <= MAX_MINOR ? minor : null;
}

const FALLBACK_COLOR = "#837663";
const validColor = (c: unknown): string => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : FALLBACK_COLOR);

/** Copy one legacy user's data into `target` (already migrated to the current schema). Runs inside the caller's transaction. */
export function importLegacyUser(
  sql: SqlJsStatic,
  bytes: Uint8Array,
  userId: number,
  target: Database,
  now: Date = new Date(),
): LegacyReport {
  const legacy = new sql.Database(bytes);
  const skipped = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  const report: LegacyReport = { transactions: 0, budgets: 0, categoriesAdded: 0, skipped: [], importedMinor: { income: 0, expense: 0 } };
  const today = todayLocal(now);

  try {
    // 1. Legacy categories → keep any the new defaults don't already have.
    const legacyCats = hasTable(legacy, "categories")
      ? query<{ name: string; icon: string; color: string; type: string }>(legacy, "SELECT name, icon, color, type FROM categories")
      : [];
    const meta = new Map(legacyCats.map((c) => [String(c.name).trim().toLowerCase(), c]));

    const findCategory = (name: string, kind: Kind) =>
      listCategories(target, { includeArchived: true }).find((c) => c.kind === kind && c.name.toLowerCase() === name.trim().toLowerCase());

    const ensureCategory = (rawName: unknown, kind: Kind): number | null => {
      const name = String(rawName ?? "").trim().slice(0, 60);
      if (!name) return null;
      const existing = findCategory(name, kind);
      if (existing) return existing.id;
      const hint = meta.get(name.toLowerCase());
      try {
        const created = addCategory(target, {
          name,
          icon: typeof hint?.icon === "string" && hint.icon ? hint.icon : "Tag",
          color: validColor(hint?.color),
          kind,
        });
        report.categoriesAdded++;
        return created.id;
      } catch (error) {
        if (error instanceof ValidationError) return findCategory(name, kind)?.id ?? null;
        throw error;
      }
    };

    // 2. Transactions.
    if (hasTable(legacy, "transactions")) {
      const rows = query<Record<string, unknown>>(
        legacy,
        "SELECT amount, type, category, description, date, createdAt FROM transactions WHERE user_id = ? ORDER BY date, id",
        [userId],
      );
      for (const row of rows) {
        const kind = row.type === "income" || row.type === "expense" ? (row.type as Kind) : null;
        if (!kind) { skip("unknown type"); continue; }
        const minor = toMinor(row.amount);
        if (minor === null) { skip("invalid amount"); continue; }
        const categoryId = ensureCategory(row.category, kind);
        if (categoryId === null) { skip("missing category"); continue; }
        const created = typeof row.createdAt === "string" && !Number.isNaN(Date.parse(row.createdAt)) ? row.createdAt : now.toISOString();
        const occurredOn = normaliseLegacyDate(row.date, normaliseLegacyDate(created, today));
        const note = String(row.description ?? "").trim().slice(0, 500);
        target.run(
          "INSERT INTO transactions (kind, amount_minor, category_id, note, occurred_on, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [kind, minor, categoryId, note, occurredOn, created],
        );
        report.transactions++;
        report.importedMinor[kind] += minor;
      }
    }

    // 3. Budgets.
    if (hasTable(legacy, "budgets")) {
      const rows = query<Record<string, unknown>>(legacy, "SELECT category, amount, period FROM budgets WHERE user_id = ? ORDER BY id", [userId]);
      const seen = new Set<string>();
      for (const row of rows) {
        const minor = toMinor(row.amount);
        if (minor === null) { skip("invalid budget amount"); continue; }
        const categoryId = ensureCategory(row.category, "expense");
        if (categoryId === null || getCategory(target, categoryId)?.kind !== "expense") { skip("budget without category"); continue; }
        const period = row.period === "weekly" || row.period === "yearly" ? row.period : "monthly";
        // The new schema allows one budget per category and period; the latest one wins.
        const key = `${categoryId}:${period}`;
        if (seen.has(key)) skip("older duplicate budget replaced");
        else seen.add(key);
        upsertBudget(target, { categoryId, amountMinor: minor, period }, now);
      }
      report.budgets = seen.size;
    }
  } finally {
    legacy.close();
  }

  report.skipped = [...skipped].map(([reason, count]) => ({ reason, count }));
  return report;
}
