import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { type Kind, type Transaction, addTransaction, updateTransaction } from "@/db/repo";
import { isDateString, todayLocal } from "@/lib/dates";
import { currencyInfo, minorToInputString, parseMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useLedger, useMutate } from "@/vault/useLedger";
import { CategoryMark } from "./bits";

interface EntryDraftSeed {
  kind?: Kind;
  amountMinor?: number;
  categoryId?: number | null;
  occurredOn?: string;
  note?: string;
}

interface EntrySheetApi {
  openNew: (seed?: EntryDraftSeed) => void;
  openEdit: (transaction: Transaction) => void;
}

const EntrySheetContext = createContext<EntrySheetApi | null>(null);

export function useEntrySheet(): EntrySheetApi {
  const ctx = useContext(EntrySheetContext);
  if (!ctx) throw new Error("useEntrySheet must be used inside <EntrySheetProvider>");
  return ctx;
}

interface Editing {
  id?: number;
  seed: EntryDraftSeed;
}

export function EntrySheetProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const isMobile = useIsMobile();

  const api = useMemo<EntrySheetApi>(
    () => ({
      openNew: (seed = {}) => setEditing({ seed }),
      openEdit: (t) =>
        setEditing({ id: t.id, seed: { kind: t.kind, amountMinor: t.amountMinor, categoryId: t.categoryId, occurredOn: t.occurredOn, note: t.note } }),
    }),
    [],
  );

  const close = useCallback(() => setEditing(null), []);
  const title = editing?.id ? "Edit entry" : "New entry";
  const description = editing?.id ? "Change any field, then save." : "Money in or money out. Press Enter to save.";

  return (
    <EntrySheetContext.Provider value={api}>
      {children}
      {isMobile ? (
        <Sheet open={!!editing} onOpenChange={(open) => !open && close()}>
          <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-lg pb-safe">
            <SheetHeader className="text-left">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            {editing ? <EntryForm key={editing.id ?? "new"} editing={editing} onDone={close} /> : null}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={!!editing} onOpenChange={(open) => !open && close()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {editing ? <EntryForm key={editing.id ?? "new"} editing={editing} onDone={close} /> : null}
          </DialogContent>
        </Dialog>
      )}
    </EntrySheetContext.Provider>
  );
}

interface Errors {
  amount?: string;
  category?: string;
  date?: string;
}

function EntryForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const ledger = useLedger();
  const mutate = useMutate();
  const currency = ledger?.currency ?? "BDT";
  const info = currencyInfo(currency);
  const seed = editing.seed;

  const [kind, setKind] = useState<Kind>(seed.kind ?? "expense");
  const [amount, setAmount] = useState(seed.amountMinor ? minorToInputString(seed.amountMinor, currency) : "");
  const [categoryId, setCategoryId] = useState<number | null>(seed.categoryId ?? null);
  const [date, setDate] = useState(seed.occurredOn ?? todayLocal());
  const [note, setNote] = useState(seed.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Radix focuses the first control; the amount is what people want to type first.
    const t = window.setTimeout(() => amountRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  const options = useMemo(() => {
    if (!ledger) return [];
    const active = ledger.categories.filter((c) => c.kind === kind);
    // An entry may point at a category archived later; keep it selectable so editing doesn't silently change it.
    const current = ledger.categoryById.get(categoryId ?? -1);
    return current && current.archived && current.kind === kind ? [current, ...active] : active;
  }, [ledger, kind, categoryId]);

  const changeKind = (next: Kind) => {
    setKind(next);
    const current = ledger?.categoryById.get(categoryId ?? -1);
    if (current && current.kind !== next) setCategoryId(null);
  };

  const submit = async (event: FormEvent, addAnother = false) => {
    event.preventDefault();
    const nextErrors: Errors = {};
    const amountMinor = parseMinor(amount, currency);
    if (amountMinor === null) nextErrors.amount = `Enter an amount above zero${info.digits ? `, up to ${info.digits} decimal places` : ""}.`;
    if (categoryId === null) nextErrors.category = "Choose a category.";
    if (!isDateString(date)) nextErrors.date = "Enter a valid date.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || amountMinor === null || categoryId === null) return;

    setBusy(true);
    const saved = await mutate(
      (db) =>
        editing.id
          ? updateTransaction(db, editing.id, { kind, amountMinor, categoryId, occurredOn: date, note })
          : addTransaction(db, { kind, amountMinor, categoryId, occurredOn: date, note }),
      { success: editing.id ? "Entry updated" : "Entry saved" },
    );
    setBusy(false);
    if (!saved) return; // the reason was shown; keep what was typed
    if (addAnother) {
      setAmount("");
      setNote("");
      amountRef.current?.focus();
    } else onDone();
  };

  return (
    <form onSubmit={(e) => submit(e)} className="mt-4 grid gap-4" noValidate>
      <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-2 gap-1 rounded-md border border-input p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => changeKind(k)}
            className={cn(
              "h-9 rounded-sm text-sm font-medium transition-colors duration-fast",
              kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-band hover:text-foreground",
            )}
          >
            {k === "expense" ? "Money out" : "Money in"}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-amount">Amount ({info.symbol})</Label>
        <Input
          id="entry-amount"
          ref={amountRef}
          inputMode="decimal"
          autoComplete="off"
          placeholder={info.digits ? "0.00" : "0"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? "entry-amount-error" : undefined}
          className="figure h-11 text-lg"
        />
        {errors.amount ? <p id="entry-amount-error" className="text-sm text-destructive">{errors.amount}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-category">Category</Label>
        <Select value={categoryId === null ? "" : String(categoryId)} onValueChange={(v) => setCategoryId(Number(v))}>
          <SelectTrigger id="entry-category" aria-invalid={!!errors.category} aria-describedby={errors.category ? "entry-category-error" : undefined}>
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span className="flex items-center gap-2">
                  <CategoryMark category={c} size={18} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category ? <p id="entry-category-error" className="text-sm text-destructive">{errors.category}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={date}
            max="9999-12-31"
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "entry-date-error" : undefined}
            className="figure"
          />
          {errors.date ? <p id="entry-date-error" className="text-sm text-destructive">{errors.date}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-note">Note (optional)</Label>
          <Input id="entry-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        {!editing.id ? (
          <Button type="button" variant="outline" disabled={busy} onClick={(e) => submit(e, true)}>Save and add another</Button>
        ) : null}
        <Button type="submit" disabled={busy}>{editing.id ? "Save changes" : "Save entry"}</Button>
      </div>
    </form>
  );
}
