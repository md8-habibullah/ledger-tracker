/**
 * The Ledger Tracker logo mark, exactly as drawn in the owner's supplied vector files (lt01 to lt04).
 * Generated from lt01-01.svg: the shapes are the owner's, nothing here is redrawn. See docs/brand/README.md.
 */

export const LOGO_VIEWBOX = "280.034 224.144 719.422 657.382";
export const LOGO_WIDTH = 719.422;
export const LOGO_HEIGHT = 657.382;

/** The owner's colours. Indigo and slate are the same on every surface; only the ink changes. */
export const LOGO_COLORS = {
  indigo: "#5a5da9",
  slate: "#6d7987",
  inkOnLight: "#231f20",
  inkOnDark: "#ffffff",
  tileDark: "#191d20",
  tileLight: "#ffffff",
} as const;

export type LogoShape =
  | { kind: "polygon"; points: string }
  | { kind: "path"; d: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number };

/** Drawn in this order: slate pages, indigo book and arrow, then the ink edges on top. */
export const LOGO_SHAPES: Record<"slate" | "indigo" | "ink", readonly LogoShape[]> = {
  slate: [
    { kind: "polygon", points: "774.26 243.68 545 243.68 545 439.24 639.32 536.18 774.26 394.5 774.26 243.68" },
    { kind: "polygon", points: "635.85 685.63 543.34 591.72 543.17 591.88 543.17 736.46 761.04 736.46 761.04 564.89 760.93 565 761.04 564.89 761.04 564.1 635.85 685.63" },
  ],
  indigo: [
    { kind: "polygon", points: "391 736.46 543.17 736.46 543.17 591.88 391 736.46" },
    { kind: "path", d: "m350.54,735.91c-35.94,0-65.19,31.47-65.19,70.15s29.24,70.15,65.19,70.15h440.29v-27.61h-440.29c-20.72,0-37.58-19.09-37.58-42.55s16.86-42.55,37.58-42.55h192.62v-27.61h-192.62Z" },
    { kind: "path", d: "m790.84,229.46h-425.89c-44.12,0-80.01,35.48-80.01,79.11v497.5h28.44v-497.5c0-27.94,23.14-50.67,51.57-50.67h395.65l30.24-28.19v-.25Z" },
    { kind: "polygon", points: "994.14 243.68 965.77 400.21 920.51 354.95 790.64 484.81 760.65 514.81 635.32 640.13 538.64 543.45 397.81 684.29 395.35 681.49 368.46 651.07 368.46 647.2 397.81 617.85 538.64 477.01 635.32 573.69 760.65 448.37 790.64 418.37 887.29 321.72 837.61 272.04 994.14 243.68" },
    { kind: "rect", x: 368.46, y: 243.68, width: 29.35, height: 506.04 },
  ],
  ink: [
    { kind: "rect", x: 543.17, y: 735.91, width: 247.67, height: 27.61 },
    { kind: "polygon", points: "760.65 564.5 760.65 739.77 790.64 739.77 790.64 535.29 760.93 565 790.64 535.29 790.64 534.51 760.65 564.5" },
    { kind: "path", d: "m764.32,791.61v28.91h-404.38c-7.99,0-14.46-6.47-14.46-14.45s6.48-14.45,14.46-14.45h404.38Z" },
    { kind: "polygon", points: "760.6 257.9 760.65 257.9 760.65 409 790.64 379 790.64 257.9 790.84 257.9 790.84 229.71 760.6 257.9" },
  ],
};
