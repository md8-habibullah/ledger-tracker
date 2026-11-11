import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Category } from "@/db/repo";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import type { BudgetStatus, MonthPoint } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { CategoryMark } from "./bits";
import { Money } from "./Money";

/* Chart marks use --chart-in / --chart-out: colours checked with the dataviz validator against both surfaces
   (lightness band, colour-vision separation, contrast). Text never wears them; identity rides the swatch beside it. */

/* ------------------------------------------------------------------ Cash flow */

interface TooltipPayload { payload?: MonthPoint }

function FlowTooltip({ active, payload, currency }: { active?: boolean; payload?: TooltipPayload[]; currency: string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const net = point.incomeMinor - point.expenseMinor;
  const fmt = (n: number) => formatMoney(n, { code: currency });
  return (
    <div className="glass px-4 py-3 text-sm [--glass-a1:0.96] [--glass-a2:0.94] [--edge-o:0.6]">
      <p className="mb-1.5 font-medium">{point.label}</p>
      <dl className="grid grid-cols-[auto_auto] gap-x-5 gap-y-1">
        <dt className="text-muted-foreground">Money in</dt><dd className="figure text-right">{fmt(point.incomeMinor)}</dd>
        <dt className="text-muted-foreground">Money out</dt><dd className="figure outflow text-right">{fmt(-point.expenseMinor)}</dd>
        <dt className="text-muted-foreground">Net</dt><dd className={cn("figure text-right", net < 0 && "outflow")}>{fmt(net)}</dd>
      </dl>
    </div>
  );
}

/** Paired in/out columns per month. The table below carries the same numbers for screen readers. */
export function CashFlowChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  return (
    <figure>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="32%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--foreground) / 0.09)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "hsl(var(--foreground) / 0.16)" }} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}
              tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
            />
            <Tooltip cursor={{ fill: "hsl(var(--foreground) / 0.06)" }} content={<FlowTooltip currency={currency} />} />
            <Bar className="bar-in" dataKey="incomeMinor" name="Money in" fill="hsl(var(--chart-in))" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar className="bar-out" dataKey="expenseMinor" name="Money out" fill="hsl(var(--chart-out))" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex gap-6 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--chart-in))]" aria-hidden />Money in</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--chart-out))]" aria-hidden />Money out</span>
      </figcaption>
      <table className="sr-only">
        <caption>Money in and out by month</caption>
        <thead><tr><th>Month</th><th>Money in</th><th>Money out</th></tr></thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.key}><td>{p.label}</td><td>{formatMoney(p.incomeMinor, { code: currency })}</td><td>{formatMoney(p.expenseMinor, { code: currency })}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ------------------------------------------------------------------ Ranked bars */

export interface RankedRow {
  category: Category | undefined;
  amountMinor: number;
  /** Same category last month (full month), for the comparison note. */
  previousMinor: number;
}

export function RankedBars({ rows, totalMinor }: { rows: RankedRow[]; totalMinor: number }) {
  const max = Math.max(...rows.map((r) => r.amountMinor), 1);
  return (
    <ol className="grid gap-4">
      {rows.map((r, i) => {
        const share = totalMinor > 0 ? Math.round((r.amountMinor / totalMinor) * 100) : 0;
        const change = r.previousMinor > 0 ? Math.round(((r.amountMinor - r.previousMinor) / r.previousMinor) * 100) : null;
        const color = r.category?.color ?? "hsl(var(--muted-foreground))";
        return (
          <li key={r.category?.id ?? `unknown-${i}`} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <CategoryMark category={r.category} size={22} />
                <span className="truncate">{r.category?.name ?? "Unknown category"}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Money minor={r.amountMinor} kind="expense" compactWhole />
                <span className="w-9 text-right text-xs text-muted-foreground">{share}%</span>
              </span>
            </div>
            <div className="h-2 bg-foreground/[0.07]" aria-hidden>
              <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (r.amountMinor / max) * 100)}%`, background: color, boxShadow: `0 0 14px -2px ${color}` }} />
            </div>
            {change !== null ? (
              <p className="text-xs text-muted-foreground">
                {change === 0 ? "Same as last month" : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% from last month`}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ Budget progress */

const STATUS_LABEL: Record<BudgetStatus, string> = { ok: "Within the limit", near: "Close to the limit", over: "Over budget" };

const STATUS_GLOW: Record<BudgetStatus, string> = {
  ok: "0 0 16px -1px hsl(var(--foil-2) / 0.7)",
  near: "0 0 16px -1px hsl(var(--foil-4) / 0.7)",
  over: "0 0 16px -1px hsl(var(--foil-6) / 0.7)",
};

const STATUS_FILL: Record<BudgetStatus, string> = {
  ok: "linear-gradient(90deg, hsl(var(--foil-1)), hsl(var(--foil-2)))",
  near: "linear-gradient(90deg, hsl(var(--foil-3)), hsl(var(--foil-4)))",
  over: "linear-gradient(90deg, hsl(var(--foil-5)), hsl(var(--foil-6)))",
};

/** A glowing gauge. Status is also spelled out in words, so colour is never the only signal. `compact` is a thin bar for tight spots: the caller must then print the percentage and status as text itself. */
export function ProgressRule({ pct, status, label, compact = false }: { pct: number; status: BudgetStatus; label: string; compact?: boolean }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={`${Math.round(pct)}% used. ${STATUS_LABEL[status]}`}
        className={cn(compact ? "h-1.5" : "h-2.5", "overflow-hidden rounded-full bg-foreground/[0.08]")}
      >
        <div className="h-full rounded-full transition-[width] duration-sheet" style={{ width: `${clamped}%`, background: STATUS_FILL[status], boxShadow: compact ? undefined : STATUS_GLOW[status] }} />
      </div>
      {compact ? null : (
        <p className={cn("mt-1.5 text-xs", status === "over" ? "text-destructive" : "text-muted-foreground")}>
          {Math.round(pct)}% used · {STATUS_LABEL[status]}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Sparkline */

/** A 10% area wash under a 2px line with an end dot ringed in the surface colour. */
export function Sparkline({ values, className, tone = "in" }: { values: number[]; className?: string; tone?: "in" | "out" | "net" }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 96;
  const h = 32;
  const pad = 5;
  const points = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const color = tone === "in" ? "hsl(var(--chart-in))" : tone === "out" ? "hsl(var(--chart-out))" : "hsl(var(--muted-foreground))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={cn("overflow-visible", className)} aria-hidden>
      <polygon points={`${points[0][0]},${h} ${line} ${last[0]},${h}`} fill={color} fillOpacity="0.1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} stroke="hsl(var(--background))" strokeWidth="2" />
    </svg>
  );
}
