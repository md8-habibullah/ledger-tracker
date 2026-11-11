import { useEffect, useRef } from "react";
import { LogoBadge } from "@/components/brand/LogoMark";
import { Seal } from "@/components/ledger/Seal";
import { DEFAULT_PBKDF2_ITERATIONS } from "@/crypto/envelope";
import { formatMoney } from "@/lib/money";
import { useCountUp } from "@/lib/useCountUp";
import { cn } from "@/lib/utils";

/* Purely illustrative numbers: the same sample balance the demo vault opens with. */
const SAMPLE_BALANCE_MINOR = 22_791_800;
const TREND = [38, 44, 41, 52, 49, 58, 55, 63, 60, 71, 66, 78, 74, 88];
const BARS_IN = [64, 82, 64, 84, 64, 64];
const BARS_OUT = [42, 47, 42, 41, 48, 29];

function trendPoints(values: number[], w: number, h: number): { line: string; lastY: number } {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 12)] as const);
  return { line: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "), lastY: pts[pts.length - 1][1] };
}

/**
 * The hero object: a small stack of glass cards at different depths. They tilt toward the pointer (the
 * way a holographic card does) while a foil highlight sweeps across the front one. Touch screens and
 * reduced-motion users get it still. Everything here is decoration over sample figures.
 */
export function HeroCards({ className }: { className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const balance = useCountUp(SAMPLE_BALANCE_MINOR, 1500);
  const { line, lastY } = trendPoints(TREND, 300, 72);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--rx", `${(-ny * 9).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(nx * 13).toFixed(2)}deg`);
    };
    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      // Normalised to roughly -1..1 across a window twice the stage's size, so the tilt is felt from a distance.
      nx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / box.width));
      ny = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / box.height));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stage} className={cn("relative mx-auto w-full max-w-[34rem] sm:aspect-square", className)} aria-hidden>
      {/* A pool of foil colour behind the cards */}
      <div
        className="absolute inset-[2%] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side at 28% 38%, hsl(var(--foil-2) / 0.7), transparent 72%), radial-gradient(closest-side at 74% 66%, hsl(var(--foil-5) / 0.65), transparent 72%), radial-gradient(closest-side at 64% 22%, hsl(var(--foil-3) / 0.65), transparent 72%)",
        }}
      />

      <div
        className="relative max-sm:flex max-sm:flex-col sm:absolute sm:inset-0"
        style={{ transform: "perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))", transition: "transform 240ms var(--ease)", transformStyle: "preserve-3d" }}
      >
        {/* Front card: the ledger */}
        <div className="relative sm:absolute sm:left-0 sm:top-[17%] sm:w-[84%]" style={{ transform: "translateZ(0)" }}>
          <div className="glass relative overflow-hidden p-5 [--edge-o:0.8] [--glass-a1:0.8] [--glass-a2:0.56] sm:p-7" style={{ borderRadius: "var(--radius-xl)" }}>
            <span className="sheen" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <LogoBadge size={36} />
                <span className="font-display text-lg font-semibold">Ledger Tracker</span>
              </div>
              <span className="rounded-full bg-foreground/[0.08] px-2.5 py-1 text-xs text-muted-foreground">Sample data</span>
            </div>
            <p className="relative mt-7 text-sm text-muted-foreground">Balance</p>
            <p className="figure glow-text relative text-[clamp(1.6rem,6vw,2.6rem)] leading-tight">{formatMoney(balance, { code: "BDT" })}</p>
            <div className="relative mt-5 h-[72px]">
              <svg viewBox="0 0 300 72" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="hero-trend" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="hsl(var(--foil-1))" />
                    <stop offset="0.45" stopColor="hsl(var(--foil-2))" />
                    <stop offset="0.75" stopColor="hsl(var(--foil-3))" />
                    <stop offset="1" stopColor="hsl(var(--foil-4))" />
                  </linearGradient>
                  <linearGradient id="hero-trend-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="hsl(var(--foil-2))" stopOpacity="0.28" />
                    <stop offset="1" stopColor="hsl(var(--foil-2))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`0,72 ${line} 300,72`} fill="url(#hero-trend-fill)" />
                <polyline points={line} fill="none" stroke="url(#hero-trend)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="absolute right-0 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-foil-4 shadow-[0_0_14px_hsl(var(--foil-4)/0.9)] ring-2 ring-background" style={{ top: `${(lastY / 72) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Lock card, floating above the top-right corner */}
        <div className="max-sm:order-first max-sm:mb-3 max-sm:self-end sm:absolute sm:right-0 sm:top-[2%] sm:w-[46%]" style={{ transform: "translateZ(70px)" }}>
          <div className="glass animate-float flex items-center gap-3 p-3 pr-4 sm:flex-col sm:items-start sm:gap-3 sm:p-4 [--edge-o:0.8] [--glass-a1:0.95] [--glass-a2:0.92]">
            <Seal size={36} glow className="shrink-0" />
            <div>
              <p className="text-sm font-medium leading-tight">Encrypted on this device</p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">AES-256-GCM, in your browser</p>
            </div>
          </div>
        </div>

        {/* Money in / out, floating below the left edge */}
        <div className="absolute bottom-[1%] left-[5%] hidden w-[52%] sm:block" style={{ transform: "translateZ(40px)" }}>
          <div className="glass animate-float p-4 [--edge-o:0.8] [--glass-a1:0.95] [--glass-a2:0.92] [animation-delay:-3s]">
            <p className="text-xs text-muted-foreground">Money in and out</p>
            <div className="mt-3 flex h-16 items-end justify-between gap-1">
              {BARS_IN.map((h, i) => (
                <div key={i} className="flex h-full items-end gap-[2px]">
                  <span className="w-[9px] rounded-t-[3px] bg-[hsl(var(--chart-in))]" style={{ height: `${h}%` }} />
                  <span className="w-[9px] rounded-t-[3px] bg-[hsl(var(--chart-out))]" style={{ height: `${BARS_OUT[i]}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Facts */}
        <div className="absolute bottom-[27%] right-[-2%] hidden sm:block" style={{ transform: "translateZ(55px)" }}>
          <span className="glass block animate-float whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium [--glass-a1:0.95] [--glass-a2:0.92] [animation-delay:-2s]">
            {DEFAULT_PBKDF2_ITERATIONS.toLocaleString("en-US")} key-stretching rounds
          </span>
        </div>
        <div className="absolute bottom-[8%] right-[6%] hidden sm:block" style={{ transform: "translateZ(30px)" }}>
          <span className="glass block animate-float whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium [--glass-a1:0.95] [--glass-a2:0.92] [animation-delay:-4.4s]">
            Open source
          </span>
        </div>
      </div>
    </div>
  );
}
