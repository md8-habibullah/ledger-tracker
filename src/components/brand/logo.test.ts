import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOGO_COLORS, LOGO_SHAPES, LOGO_SOURCES, type LogoShape } from "./logoGeometry";
import { Logo, LogoMark } from "./LogoMark";

// The owner's supplied vector files are the reference. These tests fail if the in-app mark, or any shipped logo file,
// stops matching them: a redraw, a recolour, or live text that would depend on a font being installed.
const repoFile = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const read = (rel: string) => readFileSync(repoFile(rel), "utf8");

/**
 * Reads the shapes of one of the owner's files (an Illustrator export with a class-based stylesheet), grouped by colour.
 * A shape whose class sets no fill renders black, so that is what it is read as. Background rectangles and text are not
 * shapes of the mark and are left out by only taking the three colour groups the mark is made of.
 */
function parseOriginal(svg: string) {
  const norm = (c: string) => (c.length === 4 ? `#${[...c.slice(1)].map((ch) => ch + ch).join("")}` : c).toLowerCase();
  const fills = new Map<string, string>();
  for (const [, selectors, body] of svg.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const fill = /(?:^|;|\s)fill:\s*(#[0-9a-fA-F]{3,6})/.exec(body)?.[1];
    if (fill) for (const sel of selectors.split(",")) fills.set(sel.trim().replace(/^\./, ""), norm(fill));
  }
  const out: { fill: string; shape: LogoShape }[] = [];
  for (const [, tag, attrs] of svg.matchAll(/<(polygon|path|rect)\b([^>]*)\/>/g)) {
    const attr = (name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";
    const fill = fills.get(attr("class")) ?? "#000000";
    if (tag === "polygon") out.push({ fill, shape: { kind: "polygon", points: attr("points") } });
    else if (tag === "path") out.push({ fill, shape: { kind: "path", d: attr("d") } });
    else out.push({ fill, shape: { kind: "rect", x: Number(attr("x")), y: Number(attr("y")), width: Number(attr("width")), height: Number(attr("height")) } });
  }
  return out;
}

/** One variant of the mark as the owner drew it: shapes by role, plus the colour of the edges. */
function variant(file: string) {
  const all = parseOriginal(read(`docs/brand/originals/${file}`));
  const pick = (fill: string) => all.filter((d) => d.fill === fill).map((d) => d.shape);
  const ink = all.filter((d) => d.fill !== LOGO_COLORS.indigo && d.fill !== LOGO_COLORS.slate);
  return { all, slate: pick(LOGO_COLORS.slate), indigo: pick(LOGO_COLORS.indigo), ink: ink.map((d) => d.shape), inkFills: [...new Set(ink.map((d) => d.fill))] };
}

describe("logo geometry", () => {
  const dark = variant(LOGO_SOURCES.dark);
  const light = variant(LOGO_SOURCES.light);

  it("builds each theme from its own file: lt02 for dark, lt04 for light", () => {
    expect(LOGO_SOURCES).toEqual({ light: "lt04-01.svg", dark: "lt02-01.svg" });
  });

  it("takes the dark theme's drawing and edge colour from lt02, exactly", () => {
    expect(LOGO_SHAPES.slate).toEqual(dark.slate);
    expect(LOGO_SHAPES.indigo).toEqual(dark.indigo);
    expect(LOGO_SHAPES.ink).toEqual(dark.ink);
    expect(dark.inkFills).toEqual([LOGO_COLORS.inkOnDark]);
    expect(LOGO_COLORS.inkOnDark).toBe("#ffffff");
  });

  it("takes the light theme's drawing and edge colour from lt04, exactly", () => {
    expect(LOGO_SHAPES.slate).toEqual(light.slate);
    expect(LOGO_SHAPES.indigo).toEqual(light.indigo);
    expect(LOGO_SHAPES.ink).toEqual(light.ink);
    // lt04 never sets a fill on its edge shapes, so they render black: the light logo is black, not a softened dark.
    expect(light.inkFills).toEqual([LOGO_COLORS.inkOnLight]);
    expect(LOGO_COLORS.inkOnLight).toBe("#000000");
  });

  it("uses the owner's indigo and slate in both files", () => {
    for (const v of [dark, light]) {
      expect(v.all.filter((d) => d.fill === LOGO_COLORS.indigo)).toHaveLength(5);
      expect(v.all.filter((d) => d.fill === LOGO_COLORS.slate)).toHaveLength(2);
    }
    expect(LOGO_SHAPES.slate.length + LOGO_SHAPES.indigo.length + LOGO_SHAPES.ink.length).toBe(11);
  });

  it("is the same drawing in all four supplied files (only the edges and background differ)", () => {
    for (const name of ["lt01-01.svg", "lt03-01.svg"]) {
      const other = variant(name);
      expect(other.slate).toEqual(dark.slate);
      expect(other.indigo).toEqual(dark.indigo);
    }
  });
});

describe("shipped logo files", () => {
  const files = [
    ...readdirSync(repoFile("public/brand")).filter((f) => f.endsWith(".svg")).map((f) => `public/brand/${f}`),
    "public/favicon.svg",
    "public/favicon-light.svg",
    "public/favicon-dark.svg",
    "public/logo.svg",
  ];
  const ADAPTIVE = ["public/favicon.svg", "public/logo.svg"];
  const allowed = new Set([LOGO_COLORS.indigo, LOGO_COLORS.slate, LOGO_COLORS.inkOnLight, LOGO_COLORS.inkOnDark]);

  it("ships the full set", () => {
    expect(files.map((f) => f.replace("public/", ""))).toEqual(expect.arrayContaining(["brand/mark-on-light.svg", "brand/mark-on-dark.svg", "favicon.svg", "logo.svg"]));
  });

  it.each(files)("%s: only the owner's colours, no live text, no external references", (file) => {
    const svg = read(file);
    expect(svg).not.toMatch(/<text|<tspan|font-family|<script|<image|<use|<foreignObject|href=|url\(|@import|data:/i);
    // Only the two adaptive files carry a <style>: one colour-scheme rule that swaps the ink.
    if (!ADAPTIVE.includes(file)) expect(svg).not.toMatch(/<style/i);
    const colours = [...svg.matchAll(/fill(?:="|:\s*)(#[0-9a-fA-F]{3,6})/g)].map((m) => m[1].toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(allowed.has(colour as never)).toBe(true);
  });

  it.each(ADAPTIVE)("%s: transparent, dark ink on a light browser and white ink on a dark one", (file) => {
    const svg = read(file);
    expect(svg).not.toMatch(/<rect[^>]*(width="100%"|rx=)|<circle/); // no background shape of any kind
    expect(svg).toContain(`.k{fill:${LOGO_COLORS.inkOnLight}}`);
    expect(svg).toContain(`@media (prefers-color-scheme:dark){.k{fill:${LOGO_COLORS.inkOnDark}}}`);
    expect(svg.match(/class="k"/g)).toHaveLength(LOGO_SHAPES.ink.length);
  });

  it("ships a tab icon per app theme: lt04 (black edges) for Pearl, lt02 (white edges) for Vault, both transparent", () => {
    const inkFills = (file: string) => {
      const svg = read(file);
      expect(svg).not.toMatch(/<rect[^>]*(width="100%"|rx=)|<circle/);
      const fills = [...svg.matchAll(/<(?:polygon|path|rect)[^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
      expect(fills).toHaveLength(LOGO_SHAPES.slate.length + LOGO_SHAPES.indigo.length + LOGO_SHAPES.ink.length);
      return fills.slice(LOGO_SHAPES.slate.length + LOGO_SHAPES.indigo.length);
    };
    expect(inkFills("public/favicon-light.svg")).toEqual(Array(LOGO_SHAPES.ink.length).fill(LOGO_COLORS.inkOnLight));
    expect(inkFills("public/favicon-dark.svg")).toEqual(Array(LOGO_SHAPES.ink.length).fill(LOGO_COLORS.inkOnDark));
  });

  it("ships no tile or background version of the logo", () => {
    expect(readdirSync(repoFile("public/brand")).filter((f) => /tile/i.test(f))).toEqual([]);
  });

  it("builds mark-on-light.svg from lt04 and mark-on-dark.svg from lt02", () => {
    const fillsOf = (svg: string) => [...svg.matchAll(/<(?:polygon|path|rect)[^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    const light = fillsOf(read("public/brand/mark-on-light.svg"));
    const dark = fillsOf(read("public/brand/mark-on-dark.svg"));
    expect(light.filter((f) => f === LOGO_COLORS.inkOnLight)).toHaveLength(LOGO_SHAPES.ink.length);
    expect(dark.filter((f) => f === LOGO_COLORS.inkOnDark)).toHaveLength(LOGO_SHAPES.ink.length);
    expect(light.filter((f) => f === LOGO_COLORS.inkOnDark)).toHaveLength(0);
    expect(dark.filter((f) => f === LOGO_COLORS.inkOnLight)).toHaveLength(0);
  });

  it("keeps the light and dark marks identical apart from the ink", () => {
    const light = read("public/brand/mark-on-light.svg");
    const darkMark = read("public/brand/mark-on-dark.svg");
    expect(light.split(LOGO_COLORS.inkOnLight).join(LOGO_COLORS.inkOnDark)).toBe(darkMark);
    expect(light).not.toContain(LOGO_COLORS.inkOnDark);
    expect(darkMark).not.toContain(LOGO_COLORS.inkOnLight);
  });

  it("draws every shape of the mark in each file", () => {
    for (const file of files) {
      const svg = read(file);
      for (const shape of [...LOGO_SHAPES.slate, ...LOGO_SHAPES.indigo, ...LOGO_SHAPES.ink]) {
        const needle = shape.kind === "polygon" ? shape.points : shape.kind === "path" ? shape.d : `x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"`;
        expect(svg, `${file} is missing a shape`).toContain(needle);
      }
    }
  });
});

describe("LogoMark and Logo", () => {
  const html = (tone?: "auto" | "on-light" | "on-dark") => renderToStaticMarkup(createElement(LogoMark, { tone }));

  it("draws all 11 shapes", () => {
    expect(html().match(/<(polygon|path|rect)\b/g)).toHaveLength(11);
  });

  it("follows the theme in auto, and is fixed for on-light and on-dark", () => {
    expect(html("auto")).toContain(`fill:var(--logo-ink, ${LOGO_COLORS.inkOnLight})`);
    expect(html("on-light")).toContain(`fill:${LOGO_COLORS.inkOnLight}`);
    expect(html("on-light")).not.toContain("--logo-ink");
    expect(html("on-dark")).toContain(`fill:${LOGO_COLORS.inkOnDark}`);
    expect(html("on-dark")).not.toContain("--logo-ink");
  });

  it("keeps indigo and slate on the owner's values whatever the tone", () => {
    for (const tone of ["auto", "on-light", "on-dark"] as const) {
      expect(html(tone)).toContain(`var(--logo-indigo, ${LOGO_COLORS.indigo})`);
      expect(html(tone)).toContain(`var(--logo-slate, ${LOGO_COLORS.slate})`);
    }
  });

  it("is hidden from screen readers unless it has a title", () => {
    expect(html()).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(createElement(LogoMark, { title: "Ledger Tracker" }));
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Ledger Tracker"');
    expect(named).not.toContain("aria-hidden");
  });

  it("draws the app logo transparent, with the ink following the theme and no tile behind it", () => {
    const logo = renderToStaticMarkup(createElement(Logo, { size: 40 }));
    expect(logo.startsWith("<svg")).toBe(true); // the mark itself, not wrapped in a tile
    expect(logo).toContain(`fill:var(--logo-ink, ${LOGO_COLORS.inkOnLight})`);
    expect(logo).not.toMatch(/bg-white|background|--logo-tile/);
    expect(logo.match(/<(polygon|path|rect)\b/g)).toHaveLength(11); // and no extra background rect
  });

  it("defines the ink token: dark in Pearl, white in Vault", () => {
    const css = read("src/index.css");
    const vaultAt = css.search(/:root\.dark,\s*:root\[data-theme="vault"\] \{/);
    expect(vaultAt).toBeGreaterThan(0);
    const pearl = css.slice(0, vaultAt);
    const vault = css.slice(vaultAt, css.indexOf(':root[data-density', vaultAt));
    expect(pearl).toContain(`--logo-ink: ${LOGO_COLORS.inkOnLight};`);
    expect(vault).toContain(`--logo-ink: ${LOGO_COLORS.inkOnDark};`);
    expect(pearl).toContain(`--logo-indigo: ${LOGO_COLORS.indigo};`);
    expect(pearl).toContain(`--logo-slate: ${LOGO_COLORS.slate};`);
  });
});
