import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickEntry } from '@/components/dashboard/QuickEntry';
import { TransactionDialog } from '@/components/transactions/AddTransactionDialog'; // Import Dialog
import { useTransactions } from '@/hooks/useTransactions';
import { useCurrency } from '@/hooks/useCurrency';
import { initializeDatabase, type Transaction } from '@/db';

const Index = () => {
  const {
    transactions,
    stats,
    addTransaction,
    updateTransaction // Get update function
  } = useTransactions();

  const { formatCurrency } = useCurrency();
  
  // State for Edit Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | undefined>(undefined);

  useEffect(() => {
    initializeDatabase();
  }, []);

  // Handle Edit Click
  const handleEditClick = (txn: Transaction) => {
    setTransactionToEdit(txn);
    setIsDialogOpen(true);
  };

  // Handle Add Click (from QuickEntry or Dialog close reset)
  const handleOpenAdd = () => {
    setTransactionToEdit(undefined);
    setIsDialogOpen(false); // QuickEntry handles its own add, but this resets the state
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back<span className="text-gradient">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's your financial overview for this month
          </p>
        </div>
      </div>

      {/* Quick Entry */}
      <QuickEntry onAdd={addTransaction} />

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <SpendingChart data={stats.monthlyTrends} />
        <CategoryChart data={stats.categoryBreakdown} />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Balance"
          value={formatCurrency(stats.balance)}
          icon={Wallet}
          variant="primary"
          delay={0}
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.monthlyIncome)}
          icon={TrendingUp}
          variant="income"
          delay={0.1}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.monthlyExpenses)}
          change={stats.expenseChange}
          icon={TrendingDown}
          variant="expense"
          delay={0.2}
        />
        <StatCard
          title="Savings Rate"
          value={`${stats.savingsRate.toFixed(1)}%`}
          icon={PiggyBank}
          delay={0.3}
        />
      </div>

      {/* Recent Transactions with Edit functionality */}
      <RecentTransactions 
        transactions={transactions} 
        onEdit={handleEditClick} 
      />

      {/* Transaction Dialog for Editing */}
      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAdd={addTransaction}
        onUpdate={updateTransaction}
        transactionToEdit={transactionToEdit}
      />
    </MainLayout>
  );
};

export default Index;