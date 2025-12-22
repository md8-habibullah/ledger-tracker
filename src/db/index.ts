import Dexie, { type EntityTable } from 'dexie';

export interface Transaction {
  id?: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: Date;
  createdAt: Date;
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  createdAt: Date;
}

const db = new Dexie('TakaTrack') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  categories: EntityTable<Category, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
};

db.version(1).stores({
  transactions: '++id, type, category, date, createdAt',
  categories: '++id, name, type',
  budgets: '++id, category, period',
});

// Default categories
// Halal-friendly, positive icons for categories
const defaultCategories: Omit<Category, 'id'>[] = [
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

export async function initializeDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(defaultCategories);
  }
}

export { db };
