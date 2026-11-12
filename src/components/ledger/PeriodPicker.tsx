import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { longMonth, shortMonth } from "@/lib/dates";
import { type LedgerMonths, type PeriodId, type ResolvedPeriod, PERIOD_PRESETS, shiftMonthKey } from "@/lib/period";
import { cn } from "@/lib/utils";

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const litChip = "bg-foreground/[0.1] font-medium text-foreground shadow-[0_0_0_1px_hsl(var(--foil-2)/0.5)_inset]";

const pad2 = (n: number) => String(n).padStart(2, "0");
const monthDate = (year: number, index: number) => new Date(year, index, 1);

/**
 * Choose what the Overview shows: a quick range, or one month from a calendar.
 * A small non-modal popover (no library): Escape or a click elsewhere closes it, the month grid takes arrow keys.
 */
export function PeriodPicker({
  value,
  months,
  today,
  onChange,
  className,
}: {
  value: ResolvedPeriod;
  months: LedgerMonths;
  today: string;
  onChange: (id: PeriodId) => void;
  className?: string;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef(false);
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("right");
  const [viewYear, setViewYear] = useState(() => Number(today.slice(0, 4)));
  const [focusKey, setFocusKey] = useState(today.slice(0, 7));

  const currentKey = today.slice(0, 7);
  const selected = new Set(value.months);
  const clamp = (key: string) => (key < months.min ? months.min : key > months.max ? months.max : key);
  const minYear = Number(months.min.slice(0, 4));
  const maxYear = Number(months.max.slice(0, 4));

  const monthKeys = Array.from({ length: 12 }, (_, i) => `${viewYear}-${pad2(i + 1)}`);
  const enabledKeys = monthKeys.filter((k) => k >= months.min && k <= months.max);
  // Roving tab stop: one month in the grid is reachable with Tab, the arrow keys move from there.
  const tabKey = enabledKeys.includes(focusKey) ? focusKey : (value.months.find((k) => enabledKeys.includes(k)) ?? enabledKeys[0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onOutside = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focusKey}"]`)?.focus();
  }, [focusKey, viewYear]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    // Open towards the side with room: a button at the left edge of a phone must not push the panel off-screen.
    setAlign(rect && rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right");
    const anchor = clamp(value.months[value.months.length - 1]);
    setFocusKey(anchor);
    setViewYear(Number(anchor.slice(0, 4)));
    setOpen(true);
  };

  const choose = (id: PeriodId) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12 };
    let next: string | null = null;
    if (e.key in step) next = shiftMonthKey(tabKey, step[e.key]);
    else if (e.key === "Home") next = `${viewYear}-01`;
    else if (e.key === "End") next = `${viewYear}-12`;
    if (next === null) return;
    e.preventDefault();
    const target = clamp(next);
    focusAfterRender.current = true;
    setFocusKey(target);
    setViewYear(Number(target.slice(0, 4)));
  };

  const single = value.months.length === 1;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button ref={triggerRef} type="button" variant="outline" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle}>
        <CalendarDays aria-hidden />
        <span className="sr-only">Period: </span>
        {value.label}
        <ChevronDown aria-hidden className={cn("transition-transform duration-fast", open && "rotate-180")} />
      </Button>

      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label="Choose a period"
          className={cn(
            "glass animate-settle absolute top-full z-40 mt-2 w-[min(21.5rem,calc(100vw-2rem))] p-4 [--glass-a1:0.96] [--glass-a2:0.94] [--edge-o:0.6]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div role="group" aria-label="Quick ranges" className="flex flex-wrap gap-1.5">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={value.id === p.id}
                onClick={() => choose(p.id)}
                className={cn("h-8 rounded-full px-3 text-sm transition-colors duration-fast", ring, value.id === p.id ? litChip : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="my-3 border-t border-foreground/[0.08]" />

          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0" aria-label="Previous year" disabled={viewYear <= minYear} onClick={() => setViewYear((y) => y - 1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <p className="font-medium tabular-nums" aria-live="polite">{viewYear}</p>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0" aria-label="Next year" disabled={viewYear >= maxYear} onClick={() => setViewYear((y) => y + 1)}>
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <div role="group" aria-label={`Months of ${viewYear}`} className="grid grid-cols-4 gap-1.5" onKeyDown={onGridKeyDown}>
            {monthKeys.map((key, i) => {
              const disabled = key < months.min || key > months.max;
              const isSelected = selected.has(key);
              const hasEntries = months.withEntries.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  data-key={key}
                  disabled={disabled}
                  tabIndex={key === tabKey ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-current={key === currentKey ? "date" : undefined}
                  aria-label={`${longMonth(monthDate(viewYear, i))} ${viewYear}${hasEntries ? ", has entries" : ""}`}
                  onClick={() => choose(key as PeriodId)}
                  className={cn(
                    "relative grid h-11 place-items-center rounded-md text-sm transition-colors duration-fast disabled:pointer-events-none disabled:opacity-35",
                    ring,
                    isSelected ? (single ? "btn-primary font-semibold" : litChip) : "text-foreground hover:bg-foreground/[0.07]",
                    key === currentKey && !isSelected && "shadow-[0_0_0_1px_hsl(var(--foreground)/0.22)_inset]",
                  )}
                >
                  {shortMonth(monthDate(viewYear, i))}
                  {hasEntries ? <span aria-hidden className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current opacity-50" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
