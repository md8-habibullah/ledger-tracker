import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Budget } from '@/db';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Budgets = () => {
  const { categories, stats } = useTransactions();
  const budgets = useLiveQuery(() => db.budgets.toArray()) ?? [];
  
  const [open, setOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const budgetData = {
      category,
      amount: parseFloat(amount),
      period,
      createdAt: new Date(),
    };

    if (editingBudget) {
      await db.budgets.update(editingBudget.id!, budgetData);
      toast.success('Budget updated');
    } else {
      await db.budgets.add(budgetData);
      toast.success('Budget created');
    }

    resetForm();
  };

  const resetForm = () => {
    setOpen(false);
    setEditingBudget(null);
    setCategory('');
    setAmount('');
    setPeriod('monthly');
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setCategory(budget.category);
    setAmount(budget.amount.toString());
    setPeriod(budget.period);
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    await db.budgets.delete(id);
    toast.success('Budget deleted');
  };

  const getBudgetProgress = (budget: Budget) => {
    const spent = stats.categoryBreakdown[budget.category] || 0;
    const percentage = (spent / budget.amount) * 100;
    return { spent, percentage: Math.min(percentage, 100) };
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Budgets<span className="text-gradient">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Set spending limits and track your progress
          </p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary">
              <Plus className="mr-2 h-4 w-4" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingBudget ? 'Edit Budget' : 'New Budget'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-border/50">
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Budget Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 h-12 text-lg font-mono bg-muted/50 border-border/50"
                  />
                </div>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-border/50">
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit */}
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                {editingBudget ? 'Update Budget' : 'Create Budget'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl border border-border/50 p-12 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No budgets yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first budget to start tracking your spending limits
          </p>
          <Button 
            onClick={() => setOpen(true)}
            className="bg-gradient-primary text-primary-foreground"
          >
            Create Budget
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget, index) => {
            const { spent, percentage } = getBudgetProgress(budget);
            const cat = categories.find((c) => c.name === budget.category);
            const isOverBudget = percentage >= 100;
            const isWarning = percentage >= 80 && percentage < 100;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-2xl border border-border/50 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${cat?.color}20` }}
                    >
                      <div 
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: cat?.color }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{budget.category}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{budget.period}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(budget)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(budget.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold font-mono">
                        {formatCurrency(spent)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        of {formatCurrency(budget.amount)}
                      </p>
                    </div>
                    <p className={cn(
                      "text-sm font-medium",
                      isOverBudget && "text-destructive",
                      isWarning && "text-amber-500",
                      !isOverBudget && !isWarning && "text-secondary"
                    )}>
                      {percentage.toFixed(0)}%
                    </p>
                  </div>

                  <Progress 
                    value={percentage} 
                    className={cn(
                      "h-2",
                      isOverBudget && "[&>div]:bg-destructive",
                      isWarning && "[&>div]:bg-amber-500",
                      !isOverBudget && !isWarning && "[&>div]:bg-secondary"
                    )}
                  />

                  {isOverBudget && (
                    <p className="text-xs text-destructive">
                      Over budget by {formatCurrency(spent - budget.amount)}
                    </p>
                  )}
                  {!isOverBudget && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(budget.amount - spent)} remaining
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
};

export default Budgets;
