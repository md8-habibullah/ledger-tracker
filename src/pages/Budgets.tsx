import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryMark, EmptyState, PageHeader } from "@/components/ledger/bits";
import { ProgressRule } from "@/components/ledger/charts";
import { Money } from "@/components/ledger/Money";
import { type Budget, type Period, deleteBudget, upsertBudget } from "@/db/repo";
import { parseDate, shortMonth } from "@/lib/dates";
import { currencyInfo, minorToInputString, parseMinor } from "@/lib/money";
import { type BudgetProgress, budgetProgress } from "@/lib/stats";
import { useLedger, useMutate } from "@/vault/useLedger";

const PERIOD_LABEL: Record<Period, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

function rangeLabel(p: BudgetProgress): string {
  const a = parseDate(p.range.from);
  const b = parseDate(p.range.to);
  const fmt = (d: Date) => `${d.getDate()} ${shortMonth(d)}`;
  return p.budget.period === "yearly" ? String(a.getFullYear()) : `${fmt(a)} – ${fmt(b)}`;
}

/** Straight-line projection of spend to the end of the period; only shown when it adds information. */
function projection(p: BudgetProgress, today: string): string | null {
  if (p.spentMinor === 0 || p.status === "over") return null;
  const start = parseDate(p.range.from).getTime();
  const end = parseDate(p.range.to).getTime() + 86_400_000;
  const now = parseDate(today).getTime() + 86_400_000;
  const elapsed = (now - start) / (end - start);
  if (elapsed <= 0.15 || elapsed >= 1) return null; // too early to extrapolate / period over
  const pct = Math.round(p.pct / elapsed);
  return pct > 100 ? `At this pace you'll reach about ${pct}% by the end of the period.` : null;
}

interface FormState { categoryId: number | null; amount: string; period: Period; editing: Budget | null }

export default function Budgets() {
  const ledger = useLedger();
  const mutate = useMutate();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<{ category?: string; amount?: string }>({});
  const [removing, setRemoving] = useState<Budget | null>(null);

  const rows = useMemo(
    () => (ledger ? ledger.budgets.map((b) => budgetProgress(b, ledger.transactions, ledger.today)).sort((a, b) => b.pct - a.pct) : []),
    [ledger],
  );
  if (!ledger) return null;
  const info = currencyInfo(ledger.currency);
  const expenseCategories = ledger.categories.filter((c) => c.kind === "expense");

  const openNew = () => { setErrors({}); setForm({ categoryId: null, amount: "", period: "monthly", editing: null }); };
  const openEdit = (b: Budget) => { setErrors({}); setForm({ categoryId: b.categoryId, amount: minorToInputString(b.amountMinor, ledger.currency), period: b.period, editing: b }); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const amountMinor = parseMinor(form.amount, ledger.currency);
    const next: typeof errors = {};
    if (form.categoryId === null) next.category = "Choose a category.";
    if (amountMinor === null) next.amount = "Enter a limit above zero.";
    setErrors(next);
    if (next.category || next.amount || amountMinor === null || form.categoryId === null) return;
    const categoryId = form.categoryId;
    const saved = await mutate((db) => upsertBudget(db, { categoryId, amountMinor, period: form.period }), {
      success: form.editing ? "Budget updated" : "Budget saved",
    });
    if (saved) setForm(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const done = await mutate((db) => deleteBudget(db, removing.id));
    setRemoving(null);
    if (done !== undefined) toast.success("Budget deleted");
  };

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Limits per category. Each budget counts only spending inside its own current period."
        actions={<Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" aria-hidden />New budget</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState icon={Target} title="No budgets yet" action={<Button onClick={openNew}>Set your first budget</Button>}>
          Pick a spending category and a limit for the week, month or year. You will see how much is left and when you are close to the limit.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {rows.map((p) => {
            const category = ledger.categoryById.get(p.budget.categoryId);
            const note = projection(p, ledger.today);
            return (
              <li key={p.budget.id} className="glass flex flex-col gap-5 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2.5 text-lg font-medium">
                      <CategoryMark category={category} size={26} />
                      <span className="truncate">{category?.name ?? "Unknown category"}</span>
                    </p>
                    <p className="mt-1 text-muted-foreground">{PERIOD_LABEL[p.budget.period]} · {rangeLabel(p)}</p>
                  </div>
                  <div className="-mr-2 -mt-1 flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${category?.name ?? ""} budget`} onClick={() => openEdit(p.budget)}><Pencil className="h-4 w-4" aria-hidden /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${category?.name ?? ""} budget`} onClick={() => setRemoving(p.budget)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-xl"><Money minor={p.spentMinor} /> <span className="text-sm text-muted-foreground">of</span> <Money minor={p.budget.amountMinor} className="text-muted-foreground" /></span>
                    <span className="text-sm text-muted-foreground">
                      {p.remainingMinor >= 0 ? <><Money minor={p.remainingMinor} className="text-foreground" /> left</> : <><Money minor={-p.remainingMinor} className="outflow" /> over</>}
                    </span>
                  </p>
                  <ProgressRule pct={p.pct} status={p.status} label={`${category?.name ?? "Budget"} ${p.budget.period} budget`} />
                  {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.editing ? "Edit budget" : "New budget"}</DialogTitle>
            <DialogDescription>One budget per category and period. Saving again replaces the limit.</DialogDescription>
          </DialogHeader>
          {form ? (
            <form onSubmit={save} className="grid gap-4" noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="budget-category">Category</Label>
                <Select value={form.categoryId === null ? "" : String(form.categoryId)} disabled={!!form.editing} onValueChange={(v) => setForm({ ...form, categoryId: Number(v) })}>
                  <SelectTrigger id="budget-category" aria-invalid={!!errors.category}><SelectValue placeholder="Choose a spending category" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}><span className="flex items-center gap-2"><CategoryMark category={c} size={18} />{c.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category ? <p className="text-sm text-destructive">{errors.category}</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="budget-period">Period</Label>
                <Select value={form.period} disabled={!!form.editing} onValueChange={(v) => setForm({ ...form, period: v as Period })}>
                  <SelectTrigger id="budget-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="budget-amount">Limit ({info.symbol})</Label>
                <Input id="budget-amount" inputMode="decimal" autoComplete="off" className="figure h-11 text-lg" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-invalid={!!errors.amount} placeholder={info.digits ? "0.00" : "0"} />
                {errors.amount ? <p className="text-sm text-destructive">{errors.amount}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit">{form.editing ? "Save changes" : "Save budget"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>Your entries are not affected. You can set the budget again at any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep budget</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => void confirmRemove()}>Delete budget</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
