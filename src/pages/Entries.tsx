import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { FileDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryChip, EmptyState, Kbd, PageHeader } from "@/components/ledger/bits";
import { useEntrySheet } from "@/components/ledger/EntrySheet";
import { ImportButton } from "@/components/ledger/ImportDialog";
import { Money } from "@/components/ledger/Money";
import { type Kind, type Transaction, deleteTransactions, restoreTransactions } from "@/db/repo";
import { transactionsToCsv, downloadText } from "@/lib/csv";
import { formatDayLabel } from "@/lib/dates";
import { useLedger, useMutate } from "@/vault/useLedger";

const PAGE = 100;
const ALL = "all";

export default function Entries() {
  const ledger = useLedger();
  const mutate = useMutate();
  const { openNew, openEdit } = useEntrySheet();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | typeof ALL>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.transactions.filter((t) => {
      if (kind !== ALL && t.kind !== kind) return false;
      if (categoryId !== ALL && t.categoryId !== Number(categoryId)) return false;
      if (from && t.occurredOn < from) return false;
      if (to && t.occurredOn > to) return false;
      if (q) {
        const name = ledger.categoryById.get(t.categoryId)?.name.toLowerCase() ?? "";
        if (!t.note.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [ledger, search, kind, categoryId, from, to]);

  // Reset paging and drop selections that are no longer in view whenever filters change.
  useEffect(() => {
    setVisible(PAGE);
    setSelected((prev) => {
      const ids = new Set(filtered.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE);
    }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length, visible]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.kind === "income") income += t.amountMinor;
      else expense += t.amountMinor;
    }
    return { income, expense };
  }, [filtered]);

  if (!ledger) return null;
  const filtersActive = search !== "" || kind !== ALL || categoryId !== ALL || from !== "" || to !== "";
  const clearFilters = () => { setSearch(""); setKind(ALL); setCategoryId(ALL); setFrom(""); setTo(""); };
  const shown = filtered.slice(0, visible);
  const allShownSelected = shown.length > 0 && shown.every((t) => selected.has(t.id));

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const remove = async (rows: Transaction[]) => {
    if (rows.length === 0) return;
    const removed = await mutate((db) => deleteTransactions(db, rows.map((r) => r.id)));
    if (removed === undefined) return;
    setSelected(new Set());
    toast(`Deleted ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`, {
      duration: 9000,
      action: { label: "Undo", onClick: () => void mutate((db) => restoreTransactions(db, rows), { success: "Entries restored" }) },
    });
  };

  const exportCsv = () => {
    const today = ledger.today;
    downloadText(`ledger-tracker-entries-${today}.csv`, transactionsToCsv(filtered, ledger.categoryById, ledger.currency));
    toast.success(`Exported ${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} to a CSV file`);
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, t: Transaction) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") { e.preventDefault(); openEdit(t); }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); void remove([t]); }
  };

  return (
    <>
      <PageHeader
        title="Entries"
        description={`${ledger.transactions.length} in this vault`}
        actions={
          <>
            <ImportButton origin="csv">Import CSV</ImportButton>
            <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
              <FileDown className="h-4 w-4" aria-hidden />Export CSV
            </Button>
            <Button className="gap-2" onClick={() => openNew()}><Plus className="h-4 w-4" aria-hidden />New entry</Button>
          </>
        }
      />

      <section aria-label="Filters" className="glass grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Label htmlFor="entries-search" className="sr-only">Search notes and categories</Label>
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input id="entries-search" className="pl-10" placeholder="Search notes and categories" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="entries-kind" className="sr-only">Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind | typeof ALL)}>
            <SelectTrigger id="entries-kind"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Money in and out</SelectItem>
              <SelectItem value="income">Money in</SelectItem>
              <SelectItem value="expense">Money out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="entries-category" className="sr-only">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="entries-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {ledger.allCategories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.archived ? " (archived)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="entries-from" className="w-9 shrink-0 text-muted-foreground">From</Label>
          <Input id="entries-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="figure min-w-0" />
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="entries-to" className="w-9 shrink-0 text-muted-foreground">To</Label>
          <Input id="entries-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="figure min-w-0" />
        </div>
      </section>

      {(() => {
        const strip = (
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 text-sm" aria-live="polite">
        {selected.size > 0 ? (
          <>
            <span><span className="font-medium">{selected.size} selected</span></span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear selection</Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => void remove(filtered.filter((t) => selected.has(t.id)))}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />Delete {selected.size}
              </Button>
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              {filtersActive ? " match your filters" : ""}
              {" · in "}<Money minor={totals.income} kind="income" compactWhole />{" · out "}<Money minor={totals.expense} kind="expense" compactWhole />
            </span>
            {filtersActive ? (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={clearFilters}><X className="h-3.5 w-3.5" aria-hidden />Clear filters</Button>
            ) : (
              <span className="hidden text-muted-foreground sm:inline">Click a row to edit · <Kbd>Enter</Kbd> edit · <Kbd>Del</Kbd> delete</span>
            )}
          </>
        )}
          </div>
        );
        return filtered.length === 0 ? (
          <>
            <div className="mt-4 px-1">{strip}</div>
            <EmptyState
              title={filtersActive ? "Nothing matches these filters" : "No entries yet"}
              action={
                filtersActive
                  ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                  : <div className="flex flex-wrap gap-2"><Button onClick={() => openNew()}>Add your first entry</Button><ImportButton origin="csv">Import a CSV file</ImportButton></div>
              }
              className="mt-4"
            >
              {filtersActive ? "Try a wider date range or fewer filters." : "Entries you add show up here, newest first. Moving from a spreadsheet or another device? Import the CSV file you exported."}
            </EmptyState>
          </>
        ) : (
          <div className="glass mt-5 overflow-hidden">
            <div className="border-b border-foreground/[0.08] px-5 py-2.5">{strip}</div>
            {/* contain:layout keeps the table's own horizontal scroll from widening the page on phones */}
            <div className="overflow-x-auto [contain:layout]">
              <table className="w-full border-collapse text-left md:min-w-[34rem]">
                <caption className="sr-only">Entries, newest first</caption>
                <thead className="text-muted-foreground">
                  <tr className="border-b border-foreground/[0.08]">
                    <th scope="col" className="w-12 py-3 pl-4 pr-1 font-normal">
                      <Checkbox
                        aria-label="Select all shown entries"
                        checked={allShownSelected}
                        onCheckedChange={(on) => setSelected(on ? new Set(shown.map((t) => t.id)) : new Set())}
                      />
                    </th>
                    <th scope="col" className="hidden w-28 py-3 pr-3 font-normal md:table-cell">Date</th>
                    <th scope="col" className="py-3 pr-3 font-normal">Category</th>
                    <th scope="col" className="hidden py-3 pr-3 font-normal md:table-cell">Note</th>
                    <th scope="col" className="py-3 pr-3 text-right font-normal">Amount</th>
                    <th scope="col" className="w-10 py-3 pr-3 md:w-20"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/[0.06]">
                  {shown.map((t) => (
                    <tr
                      key={t.id}
                      tabIndex={0}
                      onKeyDown={(e) => onRowKey(e, t)}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest("button,[role=checkbox],input")) openEdit(t); }}
                      aria-selected={selected.has(t.id)}
                      className="cursor-pointer transition-colors duration-fast hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] data-[sel=true]:bg-primary/[0.09]"
                      data-sel={selected.has(t.id)}
                      style={{ height: "var(--row-height)" }}
                    >
                      <td className="pl-4 pr-1">
                        <Checkbox aria-label={`Select entry from ${t.occurredOn}`} checked={selected.has(t.id)} onCheckedChange={(on) => toggle(t.id, on === true)} />
                      </td>
                      <td className="hidden whitespace-nowrap pr-3 text-muted-foreground md:table-cell" title={t.occurredOn}>{formatDayLabel(t.occurredOn, ledger.today)}</td>
                      <td className="w-full max-w-0 pr-3 md:w-auto md:max-w-[14rem]">
                        <CategoryChip category={ledger.categoryById.get(t.categoryId)} />
                        <span className="block truncate pl-7 text-sm text-muted-foreground md:hidden">
                          {formatDayLabel(t.occurredOn, ledger.today)}{t.note ? ` · ${t.note}` : ""}
                        </span>
                      </td>
                      <td className="hidden max-w-[18rem] truncate pr-3 text-muted-foreground md:table-cell">{t.note}</td>
                      <td className="pr-3 text-right"><Money minor={t.amountMinor} kind={t.kind} /></td>
                      <td className="pr-3 text-right">
                        <span className="inline-flex">
                          <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" aria-label={`Edit entry from ${t.occurredOn}`} onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete entry from ${t.occurredOn}`} onClick={() => void remove([t])}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length < filtered.length ? (
              <div ref={sentinel} className="border-t border-foreground/[0.08] py-5 text-center text-sm text-muted-foreground">
                Showing {shown.length} of {filtered.length}.{" "}
                <button className="text-primary underline underline-offset-2" onClick={() => setVisible((v) => v + PAGE)}>Show more</button>
              </div>
            ) : null}
          </div>
        );
      })()}
    </>
  );
}
