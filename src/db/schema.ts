import { type Database, query, withTransaction } from "./sql";

/**
 * Runtime schema, versioned with PRAGMA user_version. This is the ONLY place the
 * schema is defined. Add a migration by appending to MIGRATIONS - never edit an
 * existing entry once a release has shipped it.
 */

export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  kind: "income" | "expense";
}

/** Indigo and slate tones only (the brand palette). Each holds 3:1 or more with a white icon and against both the Pearl and Vault surfaces. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Salary", icon: "Banknote", color: "#5C5FAD", kind: "income" },
  { name: "Freelance", icon: "Laptop", color: "#6669B2", kind: "income" },
  { name: "Investments", icon: "TrendingUp", color: "#7173B7", kind: "income" },
  { name: "Business", icon: "Briefcase", color: "#7B7DBC", kind: "income" },
  { name: "Food & Dining", icon: "Utensils", color: "#7173B7", kind: "expense" },
  { name: "Transportation", icon: "Bus", color: "#6D7987", kind: "expense" },
  { name: "Shopping", icon: "ShoppingBag", color: "#5C5FAD", kind: "expense" },
  { name: "Entertainment", icon: "Music", color: "#818E9C", kind: "expense" },
  { name: "Bills & Utilities", icon: "Receipt", color: "#6669B2", kind: "expense" },
  { name: "Healthcare", icon: "Stethoscope", color: "#768493", kind: "expense" },
  { name: "Education", icon: "BookOpen", color: "#8587C1", kind: "expense" },
  { name: "Travel", icon: "MapPin", color: "#636F7E", kind: "expense" },
  { name: "Subscriptions", icon: "CreditCard", color: "#7B7DBC", kind: "expense" },
  { name: "Family", icon: "Users", color: "#768493", kind: "expense" },
  { name: "Charity", icon: "HandHeart", color: "#5C5FAD", kind: "expense" },
  { name: "Home", icon: "Home", color: "#636F7E", kind: "expense" },
];

interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

const HEX = "'#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'";
const DATE = "'[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'";

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "core tables",
    up(db) {
      db.run(`
        CREATE TABLE meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE categories (
          id       INTEGER PRIMARY KEY AUTOINCREMENT,
          name     TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
          icon     TEXT    NOT NULL DEFAULT 'Tag',
          color    TEXT    NOT NULL CHECK (color GLOB ${HEX}),
          kind     TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
          archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
          UNIQUE (kind, name)
        );

        CREATE TABLE transactions (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          kind         TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          category_id  INTEGER NOT NULL REFERENCES categories (id),
          note         TEXT    NOT NULL DEFAULT '' CHECK (length(note) <= 500),
          occurred_on  TEXT    NOT NULL CHECK (occurred_on GLOB ${DATE}),
          created_at   TEXT    NOT NULL
        );
        CREATE INDEX idx_transactions_date     ON transactions (occurred_on DESC, id DESC);
        CREATE INDEX idx_transactions_category ON transactions (category_id);

        CREATE TABLE budgets (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id  INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          period       TEXT    NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
          created_at   TEXT    NOT NULL,
          UNIQUE (category_id, period)
        );
      `);
      for (const c of DEFAULT_CATEGORIES) {
        db.run("INSERT INTO categories (name, icon, color, kind) VALUES (?, ?, ?, ?)", [c.name, c.icon, c.color, c.kind]);
      }
    },
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export class FutureSchemaError extends Error {
  constructor(public readonly found: number) {
    super(`This vault was saved by a newer version of Ledger Tracker (schema ${found}). Update the app to open it.`);
    this.name = "FutureSchemaError";
  }
}

export function schemaVersion(db: Database): number {
  return Number(query<{ user_version: number }>(db, "PRAGMA user_version")[0]?.user_version ?? 0);
}

/** Bring a database up to the latest schema. Each step is atomic; foreign keys are enforced afterwards. */
export function migrate(db: Database): { from: number; to: number } {
  const from = schemaVersion(db);
  if (from > LATEST_SCHEMA_VERSION) throw new FutureSchemaError(from);
  db.run("PRAGMA foreign_keys = OFF");
  for (const step of MIGRATIONS) {
    if (step.version <= from) continue;
    withTransaction(db, () => {
      step.up(db);
      // PRAGMA cannot take bound parameters; the value is a literal integer from this file.
      db.run(`PRAGMA user_version = ${step.version}`);
    });
  }
  db.run("PRAGMA foreign_keys = ON");
  return { from, to: schemaVersion(db) };
}

/** Enforce foreign keys on a freshly opened (already migrated) database. */
export function enableForeignKeys(db: Database): void {
  db.run("PRAGMA foreign_keys = ON");
}
