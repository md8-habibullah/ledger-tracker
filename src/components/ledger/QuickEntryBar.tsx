import { useMemo, useRef, useState, type FormEvent } from "react";
import { CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addTransaction } from "@/db/repo";
import { formatDayLabel } from "@/lib/dates";
import { parseQuickEntry } from "@/lib/quickEntry";
import { useLedger, useMoney, useMutate } from "@/vault/useLedger";
import { useEntrySheet } from "./EntrySheet";

/**
 * One line to record an entry: “tea 40”, “+85000 salary”, “rickshaw 60 transport yesterday”.
 * Parsed on this device. If the category can't be inferred, the full form opens pre-filled.
 */
export function QuickEntryBar() {
  const ledger = useLedger();
  const mutate = useMutate();
  const money = useMoney();
  const { openNew } = useEntrySheet();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(
    () => (ledger && text.trim() ? parseQuickEntry(text, ledger.categories, ledger.today, ledger.currency) : null),
    [ledger, text],
  );
  if (!ledger) return null;
  const category = parsed?.categoryId ? ledger.categoryById.get(parsed.categoryId) : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!parsed) return;
    if (parsed.amountMinor === null) {
      openNew({ kind: parsed.kind, note: parsed.note, occurredOn: parsed.occurredOn });
      return;
    }
    if (parsed.categoryId === null) {
      openNew({ kind: parsed.kind, amountMinor: parsed.amountMinor, note: parsed.note, occurredOn: parsed.occurredOn });
      setText("");
      return;
    }
    const amountMinor = parsed.amountMinor;
    const categoryId = parsed.categoryId;
    const saved = await mutate((db) => addTransaction(db, { kind: parsed.kind, amountMinor, categoryId, note: parsed.note, occurredOn: parsed.occurredOn }), {
      success: `Saved ${money(amountMinor, { compactWhole: true })} under ${category?.name ?? "category"}`,
    });
    if (saved) {
      setText("");
      inputRef.current?.focus();
    }
  };

  let preview: string;
  if (!parsed) preview = "Try “tea 40”, “+85000 salary” or “rickshaw 60 transport yesterday”.";
  else if (parsed.amountMinor === null) preview = "Add an amount to continue, for example “lunch 250”.";
  else {
    const parts = [
      parsed.kind === "income" ? "Money in" : "Money out",
      money(parsed.amountMinor, { compactWhole: true }),
      category ? category.name : "no category yet — Enter opens the form",
      formatDayLabel(parsed.occurredOn, ledger.today),
    ];
    if (parsed.note) parts.push(`“${parsed.note}”`);
    preview = parts.join(" · ");
  }

  return (
    <form onSubmit={submit} className="mb-8" aria-label="Quick entry">
      <label htmlFor="quick-entry" className="sr-only">Quick entry</label>
      <div className="relative">
        <Input
          id="quick-entry"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Record an entry: tea 40"
          className="h-14 rounded-full pl-6 pr-16 text-base"
          aria-describedby="quick-entry-preview"
        />
        <button
          type="submit"
          aria-label="Save quick entry"
          className="btn-primary absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full"
        >
          <CornerDownLeft className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p id="quick-entry-preview" className="mt-2.5 min-h-5 pl-6 text-sm text-muted-foreground" aria-live="polite">{preview}</p>
    </form>
  );
}
