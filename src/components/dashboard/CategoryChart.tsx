import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';

interface CategoryChartProps {
  data: Record<string, number>;
}

const COLORS = [
  'hsl(187, 85%, 53%)',
  'hsl(160, 84%, 39%)',
  'hsl(263, 70%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(330, 81%, 60%)',
  'hsl(221, 83%, 53%)',
  'hsl(0, 72%, 51%)',
  'hsl(172, 66%, 50%)',
];

export function CategoryChart({ data }: CategoryChartProps) {
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];

  const chartData = Object.entries(data)
    .map(([name, value]) => {
      const category = categories.find((c) => c.name === name);
      return {
        name,
        value,
        color: category?.color || COLORS[0],
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="glass rounded-2xl border border-border/50 p-6"
      >
        <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
          No expense data for this month
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass rounded-2xl border border-border/50 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Spending by Category</h3>
        <p className="text-sm text-muted-foreground">This month's breakdown</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                // Disable active shape if it causes flicker, or keep it for scaling
                activeShape={{ stroke: 'none' }}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    // FIX: This removes the black outline on hover
                    style={{ outline: 'none' }}
                    // Added a small stroke for better visibility between slices
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  color: 'hsl(var(--popover-foreground))',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col justify-center space-y-2">
          {chartData.slice(0, 5).map((item, index) => (
            <div key={item.name} className="flex items-center gap-3">
              <div 
                className="h-3 w-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {((item.value / total) * 100).toFixed(1)}%
                </p>
              </div>
              <p className="text-sm font-mono">{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}