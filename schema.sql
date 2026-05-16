/*
 * ============================================================================
 *  LEDGER TRACKER - ADVANCED SQLite WASM ARCHITECTURE
 * ============================================================================
 * 
 * This schema defines the complete relational structure for Ledger Tracker,
 * a Local Encrypted Vault for personal financial management.
 *
 * CRITICAL TECHNICAL NOTES:
 * ──────────────────────────
 *
 * 1. SQL.js WASM Initialization:
 *    - This schema is executed when sql.js (SQLite compiled to WebAssembly)
 *      initializes in the browser at runtime via sqlite-setup.ts
 *    - sql.js loads `sql-wasm.wasm` binary into memory and mounts it as an
 *      in-process database engine (NO server, NO network calls)
 *    - The database instance is purely ephemeral until explicitly exported
 *
 * 2. Persistence Layer:
 *    - Database state is exported as a Uint8Array using db.export()
 *    - Serialized binary is stored in localforage (IndexedDB wrapper)
 *    - On app load, sqlite-setup.ts retrieves the Uint8Array from IndexedDB
 *      and reconstructs the in-memory database via new SQL.Database(binaryData)
 *    - This design ensures 100% local storage with zero network exposure
 *
 * 3. Encryption:
 *    - Individual sensitive fields (password, etc.) are encrypted via Web Crypto API
 *    - The database file itself can be encrypted before storage in IndexedDB
 *    - AES-256-GCM is the recommended cipher (via SubtleCrypto)
 *
 * 4. Trigger Architecture:
 *    - AFTER INSERT, UPDATE, DELETE triggers on transactions table
 *    - Automatically recalculate spent_amount on budgets table
 *    - Maintains referential integrity without application logic
 *    - Prevents orphaned budget entries and stale calculations
 *
 * ============================================================================
 */

-- ============================================================================
--  USER MANAGEMENT TABLE
-- ============================================================================
-- Stores per-user authentication credentials (password should be bcrypt hashed)
--
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- ============================================================================
--  CATEGORY REFERENCE TABLE
-- ============================================================================
-- Global category definitions (shared across all users)
-- Provides UI rendering hints (icon, color) and transaction classification
--
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'both'))
);

-- ============================================================================
--  TRANSACTIONS TABLE
-- ============================================================================
-- Core financial transaction records
-- Each row represents a single income or expense event
--
-- Relationships:
--   - user_id: Foreign key to users(id) for data isolation
--   - category: Text reference to categories(name) for classification
--
-- TRIGGERS:
--   - tr_after_insert_transactions: Updates budgets.spent_amount on INSERT
--   - tr_after_update_transactions: Recalculates budgets.spent_amount on UPDATE
--   - tr_after_delete_transactions: Adjusts budgets.spent_amount on DELETE
--
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
--  BUDGETS TABLE
-- ============================================================================
-- User-defined budget limits per category
-- Tracks both the budget ceiling (amount) and cumulative spending (spent_amount)
--
-- Fields:
--   - amount: The budget limit set by the user
--   - spent_amount: Auto-calculated via triggers based on transactions total
--   - period: Aggregation period (weekly, monthly, yearly)
--
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  spent_amount REAL DEFAULT 0,
  period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
  createdAt TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, category, period)
);

-- ============================================================================
--  TRIGGER: After Insert Transaction
-- ============================================================================
-- When a new transaction is inserted, automatically update the corresponding
-- budget's spent_amount if the transaction is of type 'expense'
--
CREATE TRIGGER IF NOT EXISTS tr_after_insert_transactions
AFTER INSERT ON transactions
FOR EACH ROW
WHEN NEW.type = 'expense'
BEGIN
  UPDATE budgets
  SET spent_amount = (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = NEW.user_id
      AND t.category = NEW.category
      AND t.type = 'expense'
  )
  WHERE user_id = NEW.user_id
    AND category = NEW.category;
END;

-- ============================================================================
--  TRIGGER: After Update Transaction
-- ============================================================================
-- When an existing transaction is updated, recalculate all affected budgets
-- This handles scenarios where amount, category, or type is changed
--
CREATE TRIGGER IF NOT EXISTS tr_after_update_transactions
AFTER UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.type = 'expense' OR OLD.type = 'expense')
BEGIN
  -- Recalculate the new category's budget
  UPDATE budgets
  SET spent_amount = (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = NEW.user_id
      AND t.category = NEW.category
      AND t.type = 'expense'
  )
  WHERE user_id = NEW.user_id
    AND category = NEW.category;

  -- If category changed, also recalculate the old category's budget
  UPDATE budgets
  SET spent_amount = (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = OLD.user_id
      AND t.category = OLD.category
      AND t.type = 'expense'
  )
  WHERE user_id = OLD.user_id
    AND category = OLD.category
    AND OLD.category != NEW.category;
END;

-- ============================================================================
--  TRIGGER: After Delete Transaction
-- ============================================================================
-- When a transaction is deleted, recalculate the corresponding budget
-- Ensures spent_amount stays synchronized with actual transaction total
--
CREATE TRIGGER IF NOT EXISTS tr_after_delete_transactions
AFTER DELETE ON transactions
FOR EACH ROW
WHEN OLD.type = 'expense'
BEGIN
  UPDATE budgets
  SET spent_amount = (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM transactions t
    WHERE t.user_id = OLD.user_id
      AND t.category = OLD.category
      AND t.type = 'expense'
  )
  WHERE user_id = OLD.user_id
    AND category = OLD.category;
END;

-- ============================================================================
--  INDEX DEFINITIONS
-- ============================================================================
-- Optimize query performance for common access patterns
--
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
