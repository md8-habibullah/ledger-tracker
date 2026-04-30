import { useState, useEffect } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Save } from 'lucide-react';
import { type Transaction } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useCurrency } from '@/hooks/useCurrency';
import { useTransactions } from '@/hooks/useTransactions';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'user_id'>) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Transaction>) => Promise<void>;
  transactionToEdit?: Transaction;
}

export function TransactionDialog({ 
  open, 
  onOpenChange, 
  onAdd, 
  onUpdate, 
  transactionToEdit 
}: TransactionDialogProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { symbol } = useCurrency();
  const { categories } = useTransactions();

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  // Reset or pre-fill form when the dialog opens or transaction changes
  useEffect(() => {
    if (open) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setAmount(transactionToEdit.amount.toString());
        setDescription(transactionToEdit.description);
        setCategory(transactionToEdit.category);
        // Ensure date is in YYYY-MM-DD format for input
        const dateObj = new Date(transactionToEdit.date);
        setDate(dateObj.toISOString().split('T')[0]);
      } else {
        // Reset defaults for new transaction
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('');
        setDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [open, transactionToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !description || !category) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        amount: parseFloat(amount),
        type,
        description,
        category,
        date: date, // Keep as string for SQLite
      };

      if (transactionToEdit && transactionToEdit.id) {
        await onUpdate(transactionToEdit.id, transactionData);
        toast.success('Transaction updated successfully!');
      } else {
        await onAdd(transactionData);
        toast.success('Transaction added successfully!');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!transactionToEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Edit Transaction' : 'New Transaction'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Transaction Type Toggle */}
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all",
                type === 'expense'
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownRight className="h-4 w-4" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all",
                type === 'income'
                  ? "bg-secondary text-secondary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              Income
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{symbol}</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 h-12 text-lg font-mono bg-muted/50 border-border/50"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-12 bg-muted/50 border-border/50"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 bg-muted/50 border-border/50">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="glass-strong border-border/50">
                {filteredCategories.map((cat) => (
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

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 bg-muted/50 border-border/50"
            />
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full h-12 bg-gradient-primary text-primary-foreground hover:opacity-90"
            disabled={isSubmitting}
          >
            {isEditing ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}