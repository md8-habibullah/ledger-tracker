import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Transaction } from '@/db';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const recentTxns = transactions.slice(0, 5);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
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
              className="flex items-center gap-4 rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/50"
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
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
