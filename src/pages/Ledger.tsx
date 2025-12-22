import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  Check
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { useTransactions } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Ledger = () => {
  const { 
    transactions, 
    categories,
    addTransaction, 
    deleteTransaction,
    deleteMultipleTransactions 
  } = useTransactions();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = txn.description.toLowerCase().includes(search.toLowerCase()) ||
        txn.category.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || txn.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, search, typeFilter, categoryFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map((t) => t.id!));
    }
  };

  const handleSelect = (id: number) => {
    setSelectedIds((prev) => 
      prev.includes(id) 
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    await deleteMultipleTransactions(selectedIds);
    setSelectedIds([]);
    setShowDeleteDialog(false);
    toast.success(`Deleted ${selectedIds.length} transactions`);
  };

  const handleSingleDelete = async (id: number) => {
    await deleteTransaction(id);
    toast.success('Transaction deleted');
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Ledger<span className="text-gradient">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            All your transactions in one place
          </p>
        </div>
        <AddTransactionDialog onAdd={addTransaction} />
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl border border-border/50 p-4 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>

          {/* Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {typeFilter === 'all' ? 'All Types' : typeFilter}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-strong border-border/50">
              {['all', 'income', 'expense'].map((type) => (
                <DropdownMenuItem 
                  key={type}
                  onClick={() => setTypeFilter(type as typeof typeFilter)}
                  className="gap-2"
                >
                  {typeFilter === type && <Check className="h-4 w-4" />}
                  <span className="capitalize">{type === 'all' ? 'All Types' : type}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-strong border-border/50 max-h-[300px] overflow-auto">
              <DropdownMenuItem 
                onClick={() => setCategoryFilter('all')}
                className="gap-2"
              >
                {categoryFilter === 'all' && <Check className="h-4 w-4" />}
                All Categories
              </DropdownMenuItem>
              {categories.map((cat) => (
                <DropdownMenuItem 
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.name)}
                  className="gap-2"
                >
                  {categoryFilter === cat.name && <Check className="h-4 w-4" />}
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk Delete */}
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedIds.length})
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass rounded-2xl border border-border/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,auto] gap-4 p-4 border-b border-border/50 text-sm font-medium text-muted-foreground">
          <Checkbox
            checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span>Description</span>
          <span>Category</span>
          <span>Date</span>
          <span className="text-right">Amount</span>
          <span className="w-10"></span>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border/30">
          {filteredTransactions.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map((txn, index) => (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  "grid grid-cols-[auto,1fr,1fr,1fr,1fr,auto] gap-4 p-4 items-center transition-colors hover:bg-muted/30",
                  selectedIds.includes(txn.id!) && "bg-primary/5"
                )}
              >
                <Checkbox
                  checked={selectedIds.includes(txn.id!)}
                  onCheckedChange={() => handleSelect(txn.id!)}
                />
                
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    txn.type === 'income' 
                      ? "bg-secondary/20 text-secondary" 
                      : "bg-primary/20 text-primary"
                  )}>
                    {txn.type === 'income' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <span className="font-medium truncate">{txn.description}</span>
                </div>

                <div className="flex items-center gap-2">
                  {(() => {
                    const cat = categories.find((c) => c.name === txn.category);
                    return (
                      <>
                        <div 
                          className="h-2 w-2 rounded-full" 
                          style={{ backgroundColor: cat?.color || '#666' }}
                        />
                        <span className="text-sm">{txn.category}</span>
                      </>
                    );
                  })()}
                </div>

                <span className="text-sm text-muted-foreground">
                  {format(new Date(txn.date), 'MMM d, yyyy')}
                </span>

                <span className={cn(
                  "text-right font-mono font-semibold",
                  txn.type === 'income' ? "text-secondary" : "text-foreground"
                )}>
                  {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSingleDelete(txn.id!)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass-strong border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. These transactions will be permanently removed from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Ledger;
