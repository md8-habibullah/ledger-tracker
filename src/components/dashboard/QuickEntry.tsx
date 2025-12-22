import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, X, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface QuickEntryProps {
  onAdd: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
}

export function QuickEntry({ onAdd }: QuickEntryProps) {
  const [activeType, setActiveType] = useState<'income' | 'expense' | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { symbol } = useCurrency();

  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const filteredCategories = categories.filter(
    (c) => c.type === activeType || c.type === 'both'
  );

  const handleSubmit = async () => {
    if (!amount || !description || !category || !activeType) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await onAdd({
        amount: parseFloat(amount),
        type: activeType,
        description,
        category,
        date: new Date(),
      });

      toast.success(`${activeType === 'income' ? 'Income' : 'Expense'} added!`);
      resetForm();
    } catch (error) {
      toast.error('Failed to add transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveType(null);
    setAmount('');
    setDescription('');
    setCategory('');
  };

  return (
    <div className="mb-8">
      <AnimatePresence mode="wait">
        {!activeType ? (
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center gap-6"
          >
            {/* Expense Button (Minus) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveType('expense')}
              className="group relative flex h-24 w-36 items-center justify-center rounded-[2rem] bg-gradient-to-br from-destructive/20 to-destructive/10 border-2 border-destructive/30 hover:border-destructive/60 transition-all duration-300 hover:shadow-[0_0_30px_hsl(0_72%_51%_/_0.3)]"
            >
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Minus className="h-12 w-12 text-destructive transition-transform group-hover:scale-110" strokeWidth={3} />
            </motion.button>

            {/* Income Button (Plus) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveType('income')}
              className="group relative flex h-24 w-36 items-center justify-center rounded-[2rem] bg-gradient-to-br from-secondary/20 to-secondary/10 border-2 border-secondary/30 hover:border-secondary/60 transition-all duration-300 hover:shadow-[0_0_30px_hsl(160_84%_39%_/_0.3)]"
            >
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Plus className="h-12 w-12 text-secondary transition-transform group-hover:scale-110" strokeWidth={3} />
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "glass rounded-2xl p-6 border-2",
              activeType === 'income' ? "border-secondary/30" : "border-destructive/30"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn(
                "text-lg font-semibold",
                activeType === 'income' ? "text-secondary" : "text-destructive"
              )}>
                Quick {activeType === 'income' ? 'Income' : 'Expense'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              {/* Amount */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                  {symbol}
                </span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-12 text-lg font-mono bg-muted/50 border-border/50"
                  autoFocus
                />
              </div>

              {/* Description */}
              <Input
                placeholder="What was this for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-12 bg-muted/50 border-border/50"
              />

              {/* Category */}
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 bg-muted/50 border-border/50">
                  <SelectValue placeholder="Category" />
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

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount || !description || !category}
                className={cn(
                  "h-12 text-primary-foreground",
                  activeType === 'income' 
                    ? "bg-secondary hover:bg-secondary/90" 
                    : "bg-destructive hover:bg-destructive/90"
                )}
              >
                <Check className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
