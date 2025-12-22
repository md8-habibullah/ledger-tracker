import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '@/db';
import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export function useTransactions() {
  const transactions = useLiveQuery(async () => {
    const txns = await db.transactions.toArray();

    return txns.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA;
      }

      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }) ?? [];

  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    await db.transactions.add({
      ...transaction,
      createdAt: new Date(),
    });
  };

  const updateTransaction = async (id: number, updates: Partial<Transaction>) => {
    await db.transactions.update(id, updates);
  };

  const deleteTransaction = async (id: number) => {
    await db.transactions.delete(id);
  };

  const deleteMultipleTransactions = async (ids: number[]) => {
    await db.transactions.bulkDelete(ids);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const currentMonthTxns = transactions.filter(
      (t) => new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd
    );

    const lastMonthTxns = transactions.filter(
      (t) => new Date(t.date) >= lastMonthStart && new Date(t.date) <= lastMonthEnd
    );

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyIncome = currentMonthTxns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = currentMonthTxns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthExpenses = lastMonthTxns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
      : 0;

    const expenseChange = lastMonthExpenses > 0
      ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : 0;

    const categoryBreakdown = currentMonthTxns
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    // Monthly trends (last 6 months)
    const monthlyTrends = Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const monthTxns = transactions.filter(
        (t) => new Date(t.date) >= start && new Date(t.date) <= end
      );

      const income = monthTxns
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = monthTxns
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: format(monthDate, 'MMM'),
        income,
        expenses,
      };
    });

    return {
      totalIncome,
      totalExpenses,
      balance,
      monthlyIncome,
      monthlyExpenses,
      savingsRate,
      expenseChange,
      categoryBreakdown,
      monthlyTrends,
    };
  }, [transactions]);

  return {
    transactions,
    categories,
    stats,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteMultipleTransactions,
  };
}