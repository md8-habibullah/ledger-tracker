import { getDb, saveDb, execQuery } from './sqlite-setup';

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string; // SQLite stores as string
  createdAt: string; // SQLite stores as string
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
}

export interface Budget {
  id: number;
  user_id: number;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  password?: string;
}

export async function initializeDatabase() {
  await getDb();
}

export { getDb, saveDb, execQuery };
