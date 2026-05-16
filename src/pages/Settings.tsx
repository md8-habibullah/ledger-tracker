import { useState } from 'react';
import { motion } from 'framer-motion';
import {
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
  Globe,
  LogOut,
  Clock
} from 'lucide-react';
import { getDb, saveDb, execQuery, type Transaction, type Category, type Budget } from '@/db';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme, ThemeId } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth, type AutoLockDuration } from '@/components/auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const themeIcons: Record<ThemeId, React.ElementType> = {
  dark: Moon,
  light: Sun,
  ocean: Waves,
  forest: TreePine,
  sunset: Sunset,
};

const Settings = () => {
  const { transactions, categories, budgets } = useTransactions();
  const { user, logout, autoLockDuration, setAutoLockDuration } = useAuth();
  const queryClient = useQueryClient();

  const {
    currency,
    setCurrency,
    currencies: currencyList,
    numberFormat,
    setNumberFormat
  } = useCurrency();
  const { currentTheme, setTheme, themes: themeList } = useTheme();

  const handleAutoLockChange = (value: string) => {
    const duration = value === 'never' ? 'never' : (parseInt(value) as AutoLockDuration);
    setAutoLockDuration(duration);

    const durationText = duration === 'never' ? 'Auto-lock disabled' : `Auto-lock set to ${duration} minutes`;
    toast.success(durationText);
  };

  const handleExportData = async () => {
    const data = {
      transactions,
      categories,
      budgets,
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      appName: 'Ledger Tracker',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ledger Tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Data exported successfully!');
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const db = await getDb();

      if (data.transactions) {
        db.run('DELETE FROM transactions WHERE user_id = ?', [user.id]);
        for (const t of data.transactions) {
          db.run(
            'INSERT INTO transactions (user_id, amount, type, category, description, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, t.amount, t.type, t.category, t.description, t.date, t.createdAt]
          );
        }
      }

      if (data.budgets) {
        db.run('DELETE FROM budgets WHERE user_id = ?', [user.id]);
        for (const b of data.budgets) {
          db.run(
            'INSERT INTO budgets (user_id, category, amount, period, createdAt) VALUES (?, ?, ?, ?, ?)',
            [user.id, b.category, b.amount, b.period, b.createdAt]
          );
        }
      }

      await saveDb();
      queryClient.invalidateQueries();
      toast.success('Data imported successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to import data. Please check the file format.');
    }

    event.target.value = '';
  };

  const handleClearAllData = async () => {
    if (!user) return;
    const db = await getDb();
    db.run('DELETE FROM transactions WHERE user_id = ?', [user.id]);
    db.run('DELETE FROM budgets WHERE user_id = ?', [user.id]);
    await saveDb();
    queryClient.invalidateQueries();
    toast.success('All data has been cleared');
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Settings<span className="text-gradient">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your preferences and data
          </p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Theme Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Choose your preferred theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {themeList.map((theme) => {
                  const Icon = themeIcons[theme.id];
                  const isActive = currentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id);
                        toast.success(`Theme changed to ${theme.name}`);
                      }}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl transition-all duration-300",
                        isActive
                          ? "bg-primary/20 ring-2 ring-primary shadow-lg"
                          : "bg-muted/30 hover:bg-muted/50 border border-border/50"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-xl transition-colors",
                        isActive ? "bg-primary/30" : "bg-muted/50"
                      )}>
                        <Icon className={cn(
                          "h-6 w-6",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}>
                        {theme.name}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="activeTheme"
                          className="absolute inset-0 rounded-xl border-2 border-primary"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure vault auto-lock behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="auto-lock-select" className="text-sm font-medium">
                  Auto-Lock Vault Duration
                </Label>
                <Select
                  value={autoLockDuration === 'never' ? 'never' : autoLockDuration.toString()}
                  onValueChange={handleAutoLockChange}
                >
                  <SelectTrigger id="auto-lock-select" className="w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="5">5 Minutes</SelectItem>
                    <SelectItem value="8">8 Minutes</SelectItem>
                    <SelectItem value="10">10 Minutes</SelectItem>
                    <SelectItem value="15">15 Minutes</SelectItem>
                    <SelectItem value="30">30 Minutes</SelectItem>
                    <SelectItem value="60">60 Minutes</SelectItem>
                    <SelectItem value="never">Always Unlock (Disable Auto-Lock)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Your vault will automatically lock after {autoLockDuration === 'never' ? 'auto-lock is disabled' : `${autoLockDuration} minutes`} of inactivity.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-secondary" />
                Data Overview
              </CardTitle>
              <CardDescription>
                Logged in as <span className="font-semibold text-foreground">{user?.username}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-primary">{transactions.length}</p>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-secondary">{categories.length}</p>
                  <p className="text-xs text-muted-foreground">Categories</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold font-mono">{budgets.length}</p>
                  <p className="text-xs text-muted-foreground">Budgets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Currency Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl text-primary">৳</span>
                Currency
              </CardTitle>
              <CardDescription>
                Set your preferred currency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {currencyList.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => {
                      setCurrency(curr.code);
                      toast.success(`Currency set to ${curr.name}`);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
                      currency.code === curr.code
                        ? "bg-primary/20 text-primary ring-2 ring-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
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

        {/* Regional Number Format Setting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Regional Format
              </CardTitle>
              <CardDescription>
                Numbers display (0-9 vs local numerals)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                <button
                  onClick={() => {
                    setNumberFormat('international');
                    toast.success('Number format set to International (0-9)');
                  }}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                    numberFormat === 'international'
                      ? "bg-background shadow-sm text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  International (0-9)
                </button>
                <button
                  onClick={() => {
                    setNumberFormat('local');
                    toast.success('Number format set to Local');
                  }}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                    numberFormat === 'local'
                      ? "bg-background shadow-sm text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Local
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Export/Import */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Backup & Restore
              </CardTitle>
              <CardDescription>
                Export or import your data as JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleExportData}
                className="w-full bg-gradient-primary text-primary-foreground"
              >
                <Download className="mr-2 h-4 w-4" />
                Export My Data
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                  id="import-file"
                />
                <Label
                  htmlFor="import-file"
                  className="flex items-center justify-center gap-2 w-full h-11 px-4 rounded-lg border border-border bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Import Data from JSON
                </Label>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="glass border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions - proceed with caution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear My Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong border-border/50">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your transactions and budgets.
                      Categories will be preserved. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Categories List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mt-6"
      >
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Available expense and income categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{cat.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  );
};

export default Settings;
