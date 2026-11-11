import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, Merge, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryMark, PageHeader, RuleSection } from "@/components/ledger/bits";
import { type Category, type Kind, addCategory, deleteCategory, mergeCategories, setCategoryArchived, updateCategory } from "@/db/repo";
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES, categoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useLedger, useMutate } from "@/vault/useLedger";

interface FormState { editing: Category | null; name: string; kind: Kind; icon: string; color: string }

export default function Categories() {
  const ledger = useLedger();
  const mutate = useMutate();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<{ from: Category; intoId: number | null } | null>(null);

  const usage = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of ledger?.transactions ?? []) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1);
    return map;
  }, [ledger]);
  if (!ledger) return null;

  const openNew = (kind: Kind) => { setError(null); setForm({ editing: null, name: "", kind, icon: "Tag", color: CATEGORY_COLORS[0] }); };
  const openEdit = (c: Category) => { setError(null); setForm({ editing: c, name: c.name, kind: c.kind, icon: c.icon, color: c.color }); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    const saved = await mutate(
      (db) => (form.editing ? updateCategory(db, form.editing.id, { name: form.name, icon: form.icon, color: form.color }) : addCategory(db, { name: form.name, icon: form.icon, color: form.color, kind: form.kind })),
      { success: form.editing ? "Category updated" : "Category added" },
    );
    if (saved) setForm(null);
  };

  const confirmMerge = async () => {
    if (!merging || merging.intoId === null) return;
    const { from, intoId } = merging;
    const done = await mutate((db) => mergeCategories(db, from.id, intoId), { success: `Merged “${from.name}”` });
    if (done !== undefined) setMerging(null);
  };

  const groups: { kind: Kind; title: string; blurb: string }[] = [
    { kind: "expense", title: "Money out", blurb: "Where your money goes" },
    { kind: "income", title: "Money in", blurb: "Where your money comes from" },
  ];

  return (
    <>
      <PageHeader title="Categories" description="Rename, recolour or archive. Entries keep pointing at their category, so renaming updates every old entry." />
      <div className="grid gap-10">
        {groups.map((g) => {
          const list = ledger.allCategories.filter((c) => c.kind === g.kind);
          return (
            <RuleSection
              key={g.kind}
              title={g.title}
              description={g.blurb}
              actions={<Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNew(g.kind)}><Plus className="h-3.5 w-3.5" aria-hidden />Add category</Button>}
            >
              <ul className="bands -mx-2">
                {list.map((c) => {
                  const count = usage.get(c.id) ?? 0;
                  return (
                    <li key={c.id} className={cn("flex items-center gap-3 px-2 py-2", c.archived && "opacity-70")}>
                      <CategoryMark category={c} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}{c.archived ? <span className="font-normal text-muted-foreground"> · archived</span> : null}</span>
                        <span className="text-sm text-muted-foreground">{count === 0 ? "No entries" : `${count} ${count === 1 ? "entry" : "entries"}`}</span>
                      </span>
                      <span className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)}><Pencil className="h-4 w-4" aria-hidden /></Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Merge ${c.name} into another category`} onClick={() => setMerging({ from: c, intoId: null })}><Merge className="h-4 w-4" aria-hidden /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`}
                          onClick={() => void mutate((db) => setCategoryArchived(db, c.id, !c.archived), { success: c.archived ? "Category restored" : "Category archived" })}
                        >
                          {c.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                        </Button>
                        {count === 0 ? (
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${c.name}`} onClick={() => void mutate((db) => deleteCategory(db, c.id), { success: "Category deleted" })}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : (
                          <span className="h-9 w-9" aria-hidden />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </RuleSection>
          );
        })}
      </div>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.editing ? "Edit category" : form?.kind === "income" ? "New money-in category" : "New money-out category"}</DialogTitle>
            <DialogDescription>Choose a name, an icon and a colour.</DialogDescription>
          </DialogHeader>
          {form ? (
            <form onSubmit={save} className="grid gap-4" noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" value={form.name} maxLength={60} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error} />
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium leading-none">Icon</legend>
                <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
                  {CATEGORY_ICON_NAMES.map((name) => {
                    const Icon = categoryIcon(name);
                    const on = form.icon === name;
                    return (
                      <button key={name} type="button" role="radio" aria-checked={on} aria-label={name} onClick={() => setForm({ ...form, icon: name })}
                        className={cn("flex h-9 items-center justify-center rounded-md border", on ? "border-primary bg-band text-foreground" : "border-transparent text-muted-foreground hover:bg-band")}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium leading-none">Colour</legend>
                <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={form.color.toLowerCase() === c.toLowerCase()} aria-label={`Colour ${c}`} onClick={() => setForm({ ...form, color: c })}
                      className={cn("h-7 w-7 rounded-sm ring-offset-2 ring-offset-background", form.color.toLowerCase() === c.toLowerCase() && "ring-2 ring-foreground")} style={{ backgroundColor: c }} />
                  ))}
                  <Input aria-label="Custom hex colour" className="figure h-8 w-28" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} maxLength={7} />
                </div>
              </fieldset>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit">{form.editing ? "Save changes" : "Add category"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!merging} onOpenChange={(open) => !open && setMerging(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge “{merging?.from.name}”</DialogTitle>
            <DialogDescription>
              All {usage.get(merging?.from.id ?? -1) ?? 0} entries and any budgets move to the category you pick, then “{merging?.from.name}” is removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {merging ? (
            <div className="grid gap-1.5">
              <Label htmlFor="merge-into">Merge into</Label>
              <Select value={merging.intoId === null ? "" : String(merging.intoId)} onValueChange={(v) => setMerging({ ...merging, intoId: Number(v) })}>
                <SelectTrigger id="merge-into"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>
                  {ledger.allCategories.filter((c) => c.kind === merging.from.kind && c.id !== merging.from.id).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}><span className="flex items-center gap-2"><CategoryMark category={c} size={18} />{c.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMerging(null)}>Cancel</Button>
            <Button variant="destructive" disabled={merging?.intoId === null} onClick={() => void confirmMerge()}>Merge categories</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
