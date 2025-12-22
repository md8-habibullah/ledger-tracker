import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  Download, 
  Upload, 
  AlertTriangle,
  Palette,
  Shield,
  Moon,
  Sun,
  Waves,
  TreePine,
  Sunset,
  Globe
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useCurrency, currencies } from '@/hooks/useCurrency';
import { useTheme, themes, ThemeId } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const themeIcons: Record<ThemeId, React.ElementType> = {
  dark: Moon,
  light: Sun,
  ocean: Waves,
  forest: TreePine,
  sunset: Sunset,
};

const Settings = () => {
  const categoriesData = useLiveQuery(() => db.categories.toArray()) ?? [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) ?? [];
  
  const { 
    currency, 
    setCurrency, 
    currencies: currencyList,
    numberFormat,
    setNumberFormat 
  } = useCurrency();
  const { currentTheme, setTheme, themes: themeList } = useTheme();

  const handleExportData = async () => {
    const data = {
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      appName: 'LedgerTracker',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LedgerTracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Data exported successfully!');
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.transactions) {
        await db.transactions.clear();
        await db.transactions.bulkAdd(data.transactions.map((t: Record<string, unknown>) => ({
          ...t,
          date: new Date(t.date as string),
          createdAt: new Date(t.createdAt as string),
        })));
      }

      if (data.categories) {
        await db.categories.clear();
        await db.categories.bulkAdd(data.categories);
      }

      if (data.budgets) {
        await db.budgets.clear();
        await db.budgets.bulkAdd(data.budgets.map((b: Record<string, unknown>) => ({
          ...b,
          createdAt: new Date(b.createdAt as string),
        })));
      }

      toast.success('Data imported successfully!');
    } catch (error) {
      toast.error('Failed to import data. Please check the file format.');
    }

    event.target.value = '';
  };

  const handleClearAllData = async () => {
    await db.transactions.clear();
    await db.budgets.clear();
    toast.success('All data has been cleared');
  };

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Settings<span className="text-gradient">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your preferences and data
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Appearance
              </CardTitle>
              <CardDescription>Choose your preferred theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {themeList.map((theme) => {
                  const Icon = themeIcons[theme.id];
                  const isActive = currentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => { setTheme(theme.id); toast.success(`Theme changed to ${theme.name}`); }}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl transition-all duration-300",
                        isActive ? "bg-primary/20 ring-2 ring-primary shadow-lg" : "bg-muted/30 hover:bg-muted/50 border border-border/50"
                      )}
                    >
                      <div className={cn("p-3 rounded-xl transition-colors", isActive ? "bg-primary/30" : "bg-muted/50")}>
                        <Icon className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{theme.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Currency Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl text-primary">৳</span> Currency
              </CardTitle>
              <CardDescription>Set your preferred currency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {currencyList.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => { setCurrency(curr.code); toast.success(`Currency set to ${curr.name}`); }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
                      currency.code === curr.code ? "bg-primary/20 text-primary ring-2 ring-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="text-lg font-bold">{curr.symbol}</span>
                    <span className="text-xs">{curr.code}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* New: Number Format Setting */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Regional Format
              </CardTitle>
              <CardDescription>Numbers display (0-9 vs local)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                <button
                  onClick={() => { setNumberFormat('international'); toast.success('Format set to International'); }}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                    numberFormat === 'international' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                  )}
                >
                  International (0-9)
                </button>
                <button
                  onClick={() => { setNumberFormat('local'); toast.success('Format set to Local'); }}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                    numberFormat === 'local' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                  )}
                >
                  Local
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Backup/Restore & Danger Zone omitted for brevity, but they stay the same as your code */}
      </div>
    </MainLayout>
  );
};

export default Settings;