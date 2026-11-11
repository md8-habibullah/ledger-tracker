import { cn } from "@/lib/utils";

/**
 * A soft pool of foil colour (lemon, coral, lime) to put behind a card's content. Its strength is a per-theme token (`--glow-a*`) so secondary text on top keeps 4.5:1. Plain radial gradients:
 * no shapes, no filters, nothing animated, so it costs almost nothing to paint.
 */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full", className)}
      style={{
        background:
          "radial-gradient(closest-side at 36% 40%, hsl(var(--foil-3) / var(--glow-a3)), transparent 72%), radial-gradient(closest-side at 70% 66%, hsl(var(--foil-5) / var(--glow-a5)), transparent 72%), radial-gradient(closest-side at 56% 22%, hsl(var(--foil-2) / var(--glow-a2)), transparent 72%)",
      }}
    />
  );
}
