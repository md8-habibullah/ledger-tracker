import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDb, execQuery, saveDb, type Transaction, type Category, type Budget } from '@/db';
import { useAuth } from '@/components/auth/AuthContext';
import { useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export function useTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const db = await getDb();
      const txns = execQuery(db, 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, createdAt DESC', [user.id]);
      return txns as Transaction[];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const db = await getDb();
      const cats = execQuery(db, 'SELECT * FROM categories');
      return cats as Category[];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const db = await getDb();
      const bgs = execQuery(db, 'SELECT * FROM budgets WHERE user_id = ?', [user.id]);
      return bgs as Budget[];
    },
    enabled: !!user,
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'user_id'>) => {
      if (!user) return;
      const db = await getDb();
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO transactions (user_id, amount, type, category, description, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, transaction.amount, transaction.type, transaction.category, transaction.description, transaction.date, now]
      );
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Transaction> }) => {
      if (!user) return;
      const db = await getDb();
      
      const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id');
      const values = fields.map(k => (updates as any)[k]);
      const setClause = fields.map(k => `${k} = ?`).join(', ');
      
      if (fields.length === 0) return;

      db.run(`UPDATE transactions SET ${setClause} WHERE id = ? AND user_id = ?`, [...values, id, user.id]);
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!user) return;
      const db = await getDb();
      db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, user.id]);
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });

  const deleteMultipleTransactionsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (!user) return;
      const db = await getDb();
      const placeholders = ids.map(() => '?').join(',');
      db.run(`DELETE FROM transactions WHERE id IN (${placeholders}) AND user_id = ?`, [...ids, user.id]);
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });

  const addBudgetMutation = useMutation({
    mutationFn: async (budget: Omit<Budget, 'id' | 'createdAt' | 'user_id'>) => {
      if (!user) return;
      const db = await getDb();
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO budgets (user_id, category, amount, period, createdAt) VALUES (?, ?, ?, ?, ?)',
        [user.id, budget.category, budget.amount, budget.period, now]
      );
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id] });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Budget> }) => {
      if (!user) return;
      const db = await getDb();
      const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id' && k !== 'createdAt');
      const values = fields.map(k => (updates as any)[k]);
      const setClause = fields.map(k => `${k} = ?`).join(', ');
      
      if (fields.length === 0) return;

      db.run(`UPDATE budgets SET ${setClause} WHERE id = ? AND user_id = ?`, [...values, id, user.id]);
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id] });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!user) return;
      const db = await getDb();
      db.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, user.id]);
      await saveDb();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id] });
    },
  });

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
    budgets,
    stats,
    addTransaction: addTransactionMutation.mutateAsync,
    updateTransaction: (id: number, updates: Partial<Transaction>) => updateTransactionMutation.mutateAsync({ id, updates }),
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    deleteMultipleTransactions: deleteMultipleTransactionsMutation.mutateAsync,
    addBudget: addBudgetMutation.mutateAsync,
    updateBudget: (id: number, updates: Partial<Budget>) => updateBudgetMutation.mutateAsync({ id, updates }),
    deleteBudget: deleteBudgetMutation.mutateAsync,
    isLoading: addTransactionMutation.isPending || updateTransactionMutation.isPending || deleteTransactionMutation.isPending || deleteMultipleTransactionsMutation.isPending || addBudgetMutation.isPending || updateBudgetMutation.isPending || deleteBudgetMutation.isPending,
  };
}