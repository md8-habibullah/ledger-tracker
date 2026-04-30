-- Ledger Tracker Database Schema
-- This file documents the structure of the SQLite database used in the application.

-- 1. Users Table
-- Stores user credentials for mock authentication.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- 2. Categories Table
-- Stores transaction categories with icons and colors.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL -- 'income', 'expense', or 'both'
);

-- 3. Transactions Table
-- Stores all financial records linked to a specific user.
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL, -- 'income' or 'expense'
  category TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL, -- ISO string format
  createdAt TEXT NOT NULL, -- ISO string format
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 4. Budgets Table
-- Stores user-defined budgets for different categories.
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL, -- 'monthly', 'weekly', etc.
  createdAt TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Note: In the application, this database runs in-memory using sql.js
-- and is persisted to the browser's IndexedDB as a binary blob
-- under the key 'ledger_tracker.db'.
