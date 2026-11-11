import { useId } from "react";
import { cn } from "@/lib/utils";

interface SealProps {
  /** sealed = ring closed (locked/encrypted), open = ring broken (unlocked). */
  state?: "sealed" | "open";
  size?: number;
  /** Play the one-time draw animation on mount. */
  animate?: boolean;
  /** Soft foil glow around the ring. */
  glow?: boolean;
  className?: string;
  title?: string;
}

/**
 * The seal: a foil-stroked ring around a keyhole. It means "this is encrypted / locked".
 * Decorative unless a title is given.
 */
export function Seal({ state = "sealed", size = 20, animate = false, glow = false, className, title }: SealProps) {
  const uid = useId().replace(/:/g, "");
  // Both states use a two-value dash pattern so the ring can animate between them (a full ring, then one with a gap).
  const transition = "stroke-dasharray 450ms var(--ease), transform 450ms var(--ease)";
  const ringStyle =
    state === "sealed"
      ? animate
        ? { strokeDasharray: "100 100", animation: "seal-draw 600ms var(--ease) both", transition }
        : { strokeDasharray: "100 100", transform: "rotate(0deg)", transformOrigin: "12px 12px", transition }
      : { strokeDasharray: "74 26", transform: "rotate(-60deg)", transformOrigin: "12px 12px", transition };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0 overflow-visible", className)}
      style={glow ? { filter: "drop-shadow(0 0 7px hsl(var(--foil-2) / 0.65)) drop-shadow(0 0 18px hsl(var(--foil-4) / 0.35))" } : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={uid} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "hsl(var(--foil-1))" }} />
          <stop offset="0.5" style={{ stopColor: "hsl(var(--foil-3))" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--foil-5))" }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke={`url(#${uid})`} strokeWidth="1.75" pathLength={100} strokeLinecap="round" style={ringStyle} />
      <circle cx="12" cy="10.25" r="2.1" fill={`url(#${uid})`} />
      <path d="M12 12.2v4.1" stroke={`url(#${uid})`} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
