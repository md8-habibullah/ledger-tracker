import initSqlJs from 'sql.js';
import localforage from 'localforage';

// @ts-ignore
import sqlWasm from 'sql.js/dist/sql-wasm.wasm?url';

let dbInstance: any = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  try {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasm,
    });

    const savedDb: Uint8Array | null = await localforage.getItem('ledger_tracker.db');

    if (savedDb) {
      dbInstance = new SQL.Database(savedDb);
    } else {
      dbInstance = new SQL.Database();
      createTables(dbInstance);
      seedData(dbInstance);
      await saveDb();
    }
    
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    throw error;
  }
}

export async function saveDb() {
  if (dbInstance) {
    const data = dbInstance.export();
    await localforage.setItem('ledger_tracker.db', data);
  }
}

function createTables(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

function seedData(db: any) {
  const defaultCategories = [
    { name: 'Salary', icon: 'Banknote', color: '#10b981', type: 'income' },
    { name: 'Freelance', icon: 'Laptop', color: '#22d3ee', type: 'income' },
    { name: 'Investments', icon: 'TrendingUp', color: '#8b5cf6', type: 'income' },
    { name: 'Business', icon: 'Briefcase', color: '#f59e0b', type: 'income' },
    { name: 'Food & Dining', icon: 'Utensils', color: '#f59e0b', type: 'expense' },
    { name: 'Transportation', icon: 'Bus', color: '#3b82f6', type: 'expense' },
    { name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899', type: 'expense' },
    { name: 'Entertainment', icon: 'Music', color: '#8b5cf6', type: 'expense' },
    { name: 'Bills & Utilities', icon: 'Receipt', color: '#ef4444', type: 'expense' },
    { name: 'Healthcare', icon: 'Stethoscope', color: '#14b8a6', type: 'expense' },
    { name: 'Education', icon: 'BookOpen', color: '#6366f1', type: 'expense' },
    { name: 'Travel', icon: 'MapPin', color: '#0ea5e9', type: 'expense' },
    { name: 'Subscriptions', icon: 'CreditCard', color: '#a855f7', type: 'expense' },
    { name: 'Family', icon: 'Users', color: '#f472b6', type: 'expense' },
    { name: 'Charity', icon: 'HandHeart', color: '#10b981', type: 'expense' },
    { name: 'Home', icon: 'Home', color: '#64748b', type: 'expense' },
  ];

  for (const cat of defaultCategories) {
    db.run(
      "INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)",
      [cat.name, cat.icon, cat.color, cat.type]
    );
  }
}

/**
 * Helper to run a query and return results as an array of objects.
 */
export function execQuery(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
