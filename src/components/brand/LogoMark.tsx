import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { LOGO_COLORS, LOGO_HEIGHT, LOGO_SHAPES, LOGO_VIEWBOX, LOGO_WIDTH, type LogoShape } from "./logoGeometry";

/**
 * Which ink the mark's white edges and base line use. The owner's logo has two colours that never change
 * (indigo and slate) and one ink that has to contrast with whatever sits behind it:
 *  - "auto"     follows the theme: dark ink on Pearl, white ink on Vault (the `--logo-ink` token in index.css). Default.
 *  - "on-light" always the dark ink. For a white or light surface.
 *  - "on-dark"  always white. For a dark surface.
 * Use "auto" on the page's own background; the fixed tones for a surface whose colour you control.
 */
export type LogoTone = "auto" | "on-light" | "on-dark";

const INK: Record<LogoTone, string> = {
  auto: `var(--logo-ink, ${LOGO_COLORS.inkOnLight})`,
  "on-light": LOGO_COLORS.inkOnLight,
  "on-dark": LOGO_COLORS.inkOnDark,
};

function Shape({ shape, fill }: { shape: LogoShape; fill: string }) {
  const style: CSSProperties = { fill };
  if (shape.kind === "polygon") return <polygon points={shape.points} style={style} />;
  if (shape.kind === "path") return <path d={shape.d} style={style} />;
  return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} style={style} />;
}

/**
 * The Ledger Tracker logo mark (a ledger book with a rising arrow), drawn from the owner's own vector files:
 * the shapes are in `logoGeometry.ts` exactly as supplied, not redrawn. Indigo and slate come from the
 * `--logo-indigo` and `--logo-slate` tokens (the owner's exact values). `docs/brand/README.md` has the rules.
 */
export function LogoMark({ size = 28, tone = "auto", className, title }: { size?: number; tone?: LogoTone; className?: string; title?: string }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={(size * LOGO_HEIGHT) / LOGO_WIDTH}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {LOGO_SHAPES.slate.map((s, i) => <Shape key={`s${i}`} shape={s} fill={`var(--logo-slate, ${LOGO_COLORS.slate})`} />)}
      {LOGO_SHAPES.indigo.map((s, i) => <Shape key={`i${i}`} shape={s} fill={`var(--logo-indigo, ${LOGO_COLORS.indigo})`} />)}
      {LOGO_SHAPES.ink.map((s, i) => <Shape key={`k${i}`} shape={s} fill={INK[tone]} />)}
    </svg>
  );
}

/**
 * The logo for every brand spot in the app (headers, sidebar, hero card, splash, Settings): the owner's transparent
 * mark, no tile, with the ink following the theme through `--logo-ink`. Dark ink on Pearl, white ink on Vault.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return <LogoMark size={size} tone="auto" className={className} />;
}
