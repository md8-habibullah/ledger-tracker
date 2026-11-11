import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/useCountUp";
import { useMoney } from "@/vault/useLedger";

interface MoneyProps {
  minor: number;
  /**
   * expense → always shown as an outflow (coral, true minus). income → plain ink.
   * Omit for signed values like a balance: negative numbers become coral with a minus.
   */
  kind?: "income" | "expense";
  compactWhole?: boolean;
  /** Count up to the value when it appears or changes. Use for headline figures only. */
  animate?: boolean;
  className?: string;
}

/** Figures are the hero: mono, tabular, never wrapped. Colour is never the only signal — outflows carry “−”. */
export function Money({ minor, kind, compactWhole, animate = false, className }: MoneyProps) {
  const format = useMoney();
  const counted = useCountUp(minor);
  const value = animate ? counted : minor;
  const outflow = kind === "expense" || (kind === undefined && minor < 0);
  const shown = kind === "expense" ? -Math.abs(value) : kind === "income" ? Math.abs(value) : value;
  return <span className={cn("figure", outflow && "outflow", className)}>{format(shown, { compactWhole })}</span>;
}
