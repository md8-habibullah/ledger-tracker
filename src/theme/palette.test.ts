import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/db/schema";
import { CATEGORY_COLORS } from "@/lib/icons";
import { currentCategoryColor } from "@/lib/legacyCategoryColors";

/**
 * The colour system is three families and no more (owner's rule, 2026-11-12): indigo (the logo's #5a5da9), slate
 * (the logo's #6d7987 and the cool neutrals), and one red for money out, over budget and errors.
 * This test reads the real CSS and source, so a stray green or orange fails here, and it re-measures contrast.
 */

const ROOT = resolve(__dirname, "../..");
const css = readFileSync(join(ROOT, "src/index.css"), "utf8");

type Hsl = [number, number, number];
type Rgb = [number, number, number];

function toRgb([h, s, l]: Hsl): Rgb {
  const sa = s / 100;
  const li = l / 100;
  const c = (1 - Math.abs(2 * li - 1)) * sa;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = li - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255)) as Rgb;
}
function hexToRgb(hex: string): Rgb {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}
function rgbToHsl([r, g, b]: Rgb): Hsl {
  const [rf, gf, bf] = [r / 255, g / 255, b / 255];
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rf ? ((gf - bf) / d) % 6 : max === gf ? (bf - rf) / d + 2 : (rf - gf) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
}
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;

/** Indigo and slate sit between hue 205 and 250; the one red wraps around 350. Anything under 12% saturation is a neutral. */
const inFamily = ([h, s]: Hsl) => s < 12 || (h >= 205 && h <= 250) || h >= 340 || h <= 10;

function block(source: string, marker: string): string {
  const open = source.indexOf("{", source.indexOf(marker));
  let depth = 1;
  let i = open + 1;
  while (depth > 0) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
    i += 1;
  }
  return source.slice(open + 1, i - 1);
}
function tokens(text: string): Map<string, Hsl> {
  const out = new Map<string, Hsl>();
  for (const m of text.matchAll(/--([a-z0-9-]+):\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g)) out.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
  return out;
}
const pearl = tokens(block(css, "  :root {\n    color-scheme: light;"));
const vault = new Map([...pearl, ...tokens(block(css, "  :root.dark,"))]);
const themes = { Pearl: pearl, Vault: vault } as const;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}
/** The only file allowed to name the old rainbow hexes: it maps them to their new tone (see its header). */
const LEGACY_REMAP = join(ROOT, "src/lib/legacyCategoryColors.ts");
const files = sourceFiles(join(ROOT, "src")).filter((f) => f !== LEGACY_REMAP);

describe("the palette is indigo, slate and one red", () => {
  it("finds the theme tokens it checks", () => {
    for (const theme of Object.values(themes)) {
      for (const name of ["background", "card", "foreground", "muted-foreground", "primary", "destructive", "warn", "btn-from", "btn-to", "chart-in", "chart-out", "foil-1", "foil-7"]) {
        expect(theme.has(name), name).toBe(true);
      }
    }
  });

  it.each(Object.entries(themes))("%s: every colour token is indigo, slate or the red", (_name, theme) => {
    const stray = [...theme].filter(([, hsl]) => !inFamily(hsl)).map(([n, hsl]) => `--${n}: ${hsl.join(" ")}`);
    expect(stray).toEqual([]);
  });

  it("uses no colour literal in the source that is outside the three families", () => {
    const stray: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
        if (!inFamily(rgbToHsl(hexToRgb(m[0])))) stray.push(`${file.replace(ROOT, "")}: ${m[0]}`);
      }
      for (const m of text.matchAll(/hsl\(\s*(\d+(?:\.\d+)?)[\s_,]+(\d+(?:\.\d+)?)%[\s_,]+(\d+(?:\.\d+)?)%/g)) {
        if (!inFamily([Number(m[1]), Number(m[2]), Number(m[3])])) stray.push(`${file.replace(ROOT, "")}: ${m[0]})`);
      }
    }
    expect(stray).toEqual([]);
  });

  it("uses no Tailwind palette colour classes (every colour comes from a token)", () => {
    const stray: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|divide|accent|caret)-(?:red|green|emerald|lime|amber|yellow|orange|rose|pink|purple|violet|fuchsia|cyan|teal|sky|blue|indigo)-\d{2,3}\b/g)) stray.push(`${file.replace(ROOT, "")}: ${m[0]}`);
    }
    expect(stray).toEqual([]);
  });

  it("is the logo's own indigo and slate that the brand tokens lean on", () => {
    expect(css).toContain("--logo-indigo: #5a5da9;");
    expect(css).toContain("--logo-slate: #6d7987;");
    const brand = rgbToHsl(hexToRgb("#5a5da9"));
    for (const [name, theme] of Object.entries(themes)) {
      for (const token of ["btn-from", "btn-to", "chart-in", "foil-1"]) {
        const [h] = theme.get(token) as Hsl;
        expect(Math.abs(h - brand[0]), `${name} --${token} hue`).toBeLessThan(6);
      }
    }
    // The primary button is the brand indigo itself in Pearl (the same hue and within a few points of lightness and saturation).
    const [, s, l] = pearl.get("btn-from") as Hsl;
    expect(Math.abs(s - brand[1])).toBeLessThan(5);
    expect(Math.abs(l - brand[2])).toBeLessThan(4);
  });

  it("keeps the page's theme-color in step with the two backgrounds", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const light = /content="(#[0-9A-Fa-f]{6})" media="\(prefers-color-scheme: light\)"/.exec(html)?.[1] as string;
    const dark = /content="(#[0-9A-Fa-f]{6})" media="\(prefers-color-scheme: dark\)"/.exec(html)?.[1] as string;
    for (const [hex, theme] of [[light, pearl], [dark, vault]] as const) {
      const expected = toRgb(theme.get("background") as Hsl);
      hexToRgb(hex).forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1));
    }
  });
});

describe("contrast holds in both themes", () => {
  const rgb = (theme: Map<string, Hsl>, name: string) => toRgb(theme.get(name) as Hsl);

  describe.each(Object.entries(themes))("%s", (_name, theme) => {
    const bg = rgb(theme, "background");
    const card = rgb(theme, "card");

    it("text on the page and on cards is at least 4.5:1", () => {
      for (const surface of [bg, card]) {
        for (const text of ["foreground", "muted-foreground", "primary", "destructive"]) {
          expect(ratio(rgb(theme, text), surface), `${text}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("the primary button's text is at least 4.5:1 across the whole gradient and the button stands off the page (3:1)", () => {
      for (const end of ["btn-from", "btn-to"]) expect(ratio(rgb(theme, "btn-fg"), rgb(theme, end)), end).toBeGreaterThanOrEqual(4.5);
      expect(ratio(rgb(theme, "btn-to"), bg)).toBeGreaterThanOrEqual(3);
    });

    it("filled controls and badges keep their text readable", () => {
      for (const [fg, fill] of [["primary-foreground", "primary"], ["destructive-foreground", "destructive"], ["warn-foreground", "warn"]]) {
        expect(ratio(rgb(theme, fg), rgb(theme, fill)), fill).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("chart marks are at least 3:1 on a card, and money in and out differ in lightness as well as hue", () => {
      for (const mark of ["chart-in", "chart-out"]) expect(ratio(rgb(theme, mark), card), mark).toBeGreaterThanOrEqual(3);
      expect(ratio(rgb(theme, "chart-in"), rgb(theme, "chart-out"))).toBeGreaterThanOrEqual(1.3);
    });

    it("the light-red status fill and the input border are at least 3:1 on a card", () => {
      expect(ratio(rgb(theme, "warn"), card)).toBeGreaterThanOrEqual(3);
      expect(ratio(rgb(theme, "input"), card)).toBeGreaterThanOrEqual(3);
    });

    it("secondary text stays 4.5:1 on the strongest spot of each glow pool behind card content", () => {
      const alpha = (name: string) => Number(new RegExp(`--${name}:\\s*([\\d.]+);`).exec(block(css, theme === pearl ? "  :root {\n    color-scheme: light;" : "  :root.dark,"))?.[1]);
      for (const [pool, a] of [["foil-3", "glow-a3"], ["foil-7", "glow-a5"], ["foil-2", "glow-a2"]]) {
        const tinted = over(rgb(theme, pool), card, alpha(a));
        expect(ratio(rgb(theme, "muted-foreground"), tinted), `${pool} @ ${a}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe("category colours", () => {
  const white: Rgb = [255, 255, 255];
  const pearlPage = toRgb(pearl.get("background") as Hsl);
  const vaultCard = toRgb(vault.get("card") as Hsl);

  it("every swatch and default is indigo or slate and is 3:1 with a white icon and against both surfaces", () => {
    const all = new Set<string>([...CATEGORY_COLORS, ...DEFAULT_CATEGORIES.map((c) => c.color)]);
    for (const hex of all) {
      const rgb = hexToRgb(hex);
      const [h] = rgbToHsl(rgb);
      expect(h >= 205 && h <= 250, `${hex} hue ${Math.round(h)}`).toBe(true);
      expect(ratio(white, rgb), `${hex} with a white icon`).toBeGreaterThanOrEqual(3);
      expect(ratio(rgb, pearlPage), `${hex} on Pearl`).toBeGreaterThanOrEqual(3);
      expect(ratio(rgb, vaultCard), `${hex} on Vault`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every default category colour can be picked from the swatches", () => {
    for (const c of DEFAULT_CATEGORIES) expect(CATEGORY_COLORS as readonly string[]).toContain(c.color);
  });

  it("shows the old rainbow defaults as the new tone for the same category, and leaves other colours alone", () => {
    const OLD: Record<string, string> = {
      Salary: "#1E8A4D", Freelance: "#60831B", Investments: "#2B8B27", Business: "#A36F14", "Food & Dining": "#C55911", Transportation: "#8B760E",
      Shopping: "#D34558", Entertainment: "#D0437C", "Bills & Utilities": "#DC3D38", Healthcare: "#268764", Education: "#76801E", Travel: "#AD6B1F",
      Subscriptions: "#D94520", Family: "#B36442", Charity: "#2B883A", Home: "#837663",
    };
    for (const c of DEFAULT_CATEGORIES) {
      expect(currentCategoryColor(OLD[c.name]), c.name).toBe(c.color);
      expect(currentCategoryColor(OLD[c.name].toLowerCase()), `${c.name} (lower case)`).toBe(c.color);
    }
    expect(currentCategoryColor("#123456")).toBe("#123456");
    expect(currentCategoryColor(CATEGORY_COLORS[0])).toBe(CATEGORY_COLORS[0]);
  });
});
