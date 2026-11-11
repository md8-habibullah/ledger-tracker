import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type Budget, type Category, type Transaction, ValidationError, listBudgets, listCategories, listTransactions } from "@/db/repo";
import { type Database, withTransaction } from "@/db/sql";
import { todayLocal } from "@/lib/dates";
import { DEFAULT_CURRENCY, type FormatOptions, currencyInfo, formatMoney } from "@/lib/money";
import { type Stats, computeStats } from "@/lib/stats";
import { useVault } from "./VaultProvider";

export interface LedgerData {
  transactions: Transaction[];
  /** Everything, including archived (needed to label old entries). */
  allCategories: Category[];
  /** Non-archived only (for pickers). */
  categories: Category[];
  categoryById: Map<number, Category>;
  budgets: Budget[];
  currency: string;
  vaultName: string;
  stats: Stats;
  today: string;
}

/**
 * Snapshot of the open vault. The database is in memory and queries are synchronous, so there is
 * no query cache: data is re-read whenever a save completes (dataVersion), and nothing outlives a lock.
 */
export function useLedger(): LedgerData | null {
  const { service, snapshot } = useVault();
  return useMemo(() => {
    if (!service || snapshot.status !== "unlocked") return null;
    const db = service.database();
    const transactions = listTransactions(db);
    const allCategories = listCategories(db, { includeArchived: true });
    const settings = service.settings();
    const today = todayLocal();
    return {
      transactions,
      allCategories,
      categories: allCategories.filter((c) => !c.archived),
      categoryById: new Map(allCategories.map((c) => [c.id, c])),
      budgets: listBudgets(db),
      currency: settings.currency,
      vaultName: settings.name,
      stats: computeStats(transactions, today),
      today,
    };
    // dataVersion changes after every completed save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, snapshot.status, snapshot.dataVersion]);
}

/** Money formatter bound to the open vault's currency. */
export function useMoney(): (minor: number, options?: Omit<FormatOptions, "code">) => string {
  const ledger = useLedger();
  const code = ledger?.currency ?? DEFAULT_CURRENCY;
  return useCallback((minor, options) => formatMoney(minor, { ...options, code }), [code]);
}

export function useCurrencyInfo() {
  const ledger = useLedger();
  return currencyInfo(ledger?.currency ?? DEFAULT_CURRENCY);
}

export function describeError(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not save to this device: ${detail}`;
}

/**
 * Run a write as one atomic unit, then persist it (encrypted). Resolves to the result, or undefined
 * after showing the reason. A failed save keeps the on-screen state in memory — say so loudly.
 */
export function useMutate() {
  const { service } = useVault();
  return useCallback(
    async <T,>(work: (db: Database) => T, options: { success?: string } = {}): Promise<T | undefined> => {
      if (!service) return undefined;
      let result: T;
      try {
        const db = service.database();
        result = withTransaction(db, () => work(db));
      } catch (error) {
        toast.error(describeError(error));
        return undefined;
      }
      try {
        await service.save();
      } catch (error) {
        toast.error(`${describeError(error)} Export a backup from Settings → Data to keep your changes.`, { duration: 12000 });
        return undefined;
      }
      if (options.success) toast.success(options.success);
      return result;
    },
    [service],
  );
}
