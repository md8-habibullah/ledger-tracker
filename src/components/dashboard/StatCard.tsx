import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'income' | 'expense';
  delay?: number;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  variant = 'default',
  delay = 0
}: StatCardProps) {
  // Add the styles to the variants objects
  const variants = {
    default: 'bg-card border-border',
    primary: 'glass neon-border',
    secondary: 'bg-secondary/10 border-secondary/20',
    destructive: 'bg-destructive/10 border-destructive/20',
    // New variants using your tailwind colors
    income: 'bg-emerald-500/10 border-emerald-500/20',
    expense: 'bg-rose-500/10 border-rose-500/20',
  };;

  const iconVariants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/20 text-primary',
    secondary: 'bg-secondary/20 text-secondary',
    destructive: 'bg-destructive/20 text-destructive',
    // New icon backgrounds
    income: 'bg-emerald-500/20 text-emerald-500',
    expense: 'bg-rose-500/20 text-rose-500',
  };;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 transition-all hover:scale-[1.02]",
        variants[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight font-mono">{value}</p>
          {change !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              change >= 0
                ? "bg-secondary/20 text-secondary"
                : "bg-destructive/20 text-destructive"
            )}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          iconVariants[variant]
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      {/* Decorative gradient */}
      {variant === 'primary' && (
        <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
      )}
    </motion.div>
  );
}
