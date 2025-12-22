import { useState } from 'react'; // Added useState
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, ChevronRight, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Transaction } from '@/db';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TransactionDetailsDialog } from '@/components/transactions/TransactionDetailsDialog'; // Import new component

interface RecentTransactionsProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
}

export function RecentTransactions({ transactions, onEdit }: RecentTransactionsProps) {
  const recentTxns = transactions.slice(0, 5);
  
  // State for details dialog
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleRowClick = (txn: Transaction) => {
    setSelectedTxn(txn);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="glass rounded-2xl border border-border/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">Latest activity</p>
          </div>
          <Link to="/ledger">
            <Button variant="ghost" size="sm" className="text-primary">
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {recentTxns.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No transactions yet. Add your first one!
          </div>
        ) : (
          <div className="space-y-3">
            {recentTxns.map((txn, index) => (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleRowClick(txn)} // Add click handler
                className="flex items-center gap-4 rounded-xl bg-muted/30 p-4 transition-all duration-200 hover:bg-muted/50 cursor-pointer active:scale-[0.99]"
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  txn.type === 'income' 
                    ? "bg-secondary/20 text-secondary" 
                    : "bg-primary/20 text-primary"
                )}>
                  {txn.type === 'income' ? (
                    <ArrowUpRight className="h-5 w-5" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{txn.description}</p>
                  <p className="text-sm text-muted-foreground">{txn.category}</p>
                </div>

                <div className="text-right">
                  <p className={cn(
                    "font-mono font-semibold",
                    txn.type === 'income' ? "text-secondary" : "text-foreground"
                  )}>
                    {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(txn.date), 'MMM d')}
                  </p>
                </div>
                
                {/* Keep existing button as quick action, but ensure it stops propagation */}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent opening details
                      onEdit(txn);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-primary ml-2 hidden sm:flex" // Hide on very small screens to save space
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Details Dialog */}
      <TransactionDetailsDialog 
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        transaction={selectedTxn}
        onEdit={(txn) => {
          if (onEdit) onEdit(txn);
        }}
      />
    </>
  );
}