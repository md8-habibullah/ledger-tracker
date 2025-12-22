import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';

interface SpendingChartProps {
  data: Array<{
    month: string;
    income: number;
    expenses: number;
  }>;
}

export function SpendingChart({ data }: SpendingChartProps) {
  const { formatCurrency, symbol } = useCurrency();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="glass rounded-2xl border border-border/50 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Spending Trends</h3>
        <p className="text-sm text-muted-foreground">Income vs Expenses over 6 months</p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(346, 84%, 61%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(346, 84%, 61%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
              tickFormatter={(value) => `${symbol}${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(222, 47%, 10%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: '12px' }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
              formatter={(value: number) => [formatCurrency(value), '']}
            />
            <Area type="monotone" dataKey="income" stroke="hsl(160, 84%, 39%)" strokeWidth={2} fill="url(#incomeGradient)" name="Income" />
            <Area type="monotone" dataKey="expenses" stroke="hsl(346, 84%, 61%)" strokeWidth={2} fill="url(#expenseGradient)" name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-muted-foreground">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="text-sm text-muted-foreground">Expenses</span>
        </div>
      </div>
    </motion.div>
  );
}