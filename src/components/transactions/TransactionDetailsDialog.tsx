import { format } from 'date-fns';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Tag, 
  AlignLeft,
  Pencil,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { type Transaction } from '@/db';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEdit: (transaction: Transaction) => void;
}

export function TransactionDetailsDialog({ 
  open, 
  onOpenChange, 
  transaction,
  onEdit 
}: TransactionDetailsDialogProps) {
  const { formatCurrency } = useCurrency();

  if (!transaction) return null;

  const handleEditClick = () => {
    onOpenChange(false); // Close details modal
    onEdit(transaction); // Open edit modal
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 sm:max-w-[425px] p-0 overflow-hidden gap-0">
        
        {/* Header Section with Color Background */}
        <div className={cn(
          "p-6 flex flex-col items-center justify-center relative",
          transaction.type === 'income' 
            ? "bg-secondary/10" 
            : "bg-primary/10"
        )}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>

          <div className={cn(
            "h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
            transaction.type === 'income' 
              ? "bg-secondary text-secondary-foreground" 
              : "bg-primary text-primary-foreground"
          )}>
            {transaction.type === 'income' ? (
              <ArrowUpRight className="h-8 w-8" />
            ) : (
              <ArrowDownRight className="h-8 w-8" />
            )}
          </div>
          
          <h2 className={cn(
            "text-3xl font-bold tracking-tight font-mono",
            transaction.type === 'income' ? "text-secondary" : "text-primary"
          )}>
            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
          </h2>
          <span className="text-sm font-medium text-muted-foreground mt-1 capitalize uppercase tracking-wider">
            {transaction.type}
          </span>
        </div>

        {/* Details Body */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-lg bg-muted/50 text-muted-foreground">
              <AlignLeft className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</p>
              <p className="text-base font-medium mt-0.5">{transaction.description}</p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Category */}
          <div className="flex items-start gap-3">
             <div className="mt-1 p-2 rounded-lg bg-muted/50 text-muted-foreground">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-medium">{transaction.category}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Date */}
          <div className="flex items-start gap-3">
             <div className="mt-1 p-2 rounded-lg bg-muted/50 text-muted-foreground">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</p>
              <p className="text-base font-medium mt-0.5">
                {format(new Date(transaction.date), 'EEEE, MMMM do, yyyy')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex gap-3">
            <Button 
              className="flex-1 gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={handleEditClick}
            >
              <Pencil className="h-4 w-4" />
              Edit Transaction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}