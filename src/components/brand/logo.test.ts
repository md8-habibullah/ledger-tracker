import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOGO_COLORS, LOGO_SHAPES, type LogoShape } from "./logoGeometry";
import { LogoBadge, LogoMark } from "./LogoMark";

// The owner's supplied vector files are the reference. These tests fail if the in-app mark, or any shipped logo file,
// stops matching them: a redraw, a recolour, or live text that would depend on a font being installed.
const repoFile = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const read = (rel: string) => readFileSync(repoFile(rel), "utf8");

/** Reads shapes and their fill out of one of the owner's files (an Illustrator export with a class-based stylesheet). */
function parseOriginal(svg: string) {
  const fills = new Map<string, string>(); // class name -> fill
  for (const [, selectors, body] of svg.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const fill = /(?:^|;|\s)fill:\s*(#[0-9a-fA-F]{3,6})/.exec(body)?.[1];
    if (fill) for (const sel of selectors.split(",")) fills.set(sel.trim().replace(/^\./, ""), fill.toLowerCase());
  }
  const out: { fill: string; shape: LogoShape }[] = [];
  for (const [, tag, attrs] of svg.matchAll(/<(polygon|path|rect)\b([^>]*)\/>/g)) {
    const attr = (name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";
    const fill = fills.get(attr("class"));
    if (!fill) continue;
    if (tag === "polygon") out.push({ fill, shape: { kind: "polygon", points: attr("points") } });
    else if (tag === "path") out.push({ fill, shape: { kind: "path", d: attr("d") } });
    else out.push({ fill, shape: { kind: "rect", x: Number(attr("x")), y: Number(attr("y")), width: Number(attr("width")), height: Number(attr("height")) } });
  }
  return out;
}

describe("logo geometry", () => {
  const dark = parseOriginal(read("docs/brand/originals/lt01-01.svg"));

  it("uses the owner's colours exactly", () => {
    const fills = new Set(dark.map((d) => d.fill));
    expect(fills.has(LOGO_COLORS.indigo)).toBe(true);
    expect(fills.has(LOGO_COLORS.slate)).toBe(true);
    expect(fills.has("#fff")).toBe(true); // the ink on the dark version
    expect(LOGO_COLORS.inkOnDark).toBe("#ffffff");
    expect(fills.has(LOGO_COLORS.tileDark)).toBe(true); // lt01's own background
  });

  it("matches the owner's shapes, one for one and in the same order", () => {
    const pick = (fill: string) => dark.filter((d) => d.fill === fill).map((d) => d.shape);
    expect(LOGO_SHAPES.slate).toEqual(pick(LOGO_COLORS.slate));
    expect(LOGO_SHAPES.indigo).toEqual(pick(LOGO_COLORS.indigo));
    expect(LOGO_SHAPES.ink).toEqual(pick("#fff"));
    expect(LOGO_SHAPES.slate.length + LOGO_SHAPES.indigo.length + LOGO_SHAPES.ink.length).toBe(11);
  });

  it("is the same drawing in all four supplied files (only the ink and background differ)", () => {
    for (const name of ["lt02-01.svg", "lt03-01.svg", "lt04-01.svg"]) {
      const other = parseOriginal(read(`docs/brand/originals/${name}`));
      const geometry = (list: typeof dark) => list.filter((d) => d.fill === LOGO_COLORS.slate || d.fill === LOGO_COLORS.indigo).map((d) => d.shape);
      expect(geometry(other)).toEqual(geometry(dark));
    }
  });
});

describe("shipped logo files", () => {
  const files = [
    ...readdirSync(repoFile("public/brand")).filter((f) => f.endsWith(".svg")).map((f) => `public/brand/${f}`),
    "public/favicon.svg",
    "public/logo.svg",
  ];
  const allowed = new Set([LOGO_COLORS.indigo, LOGO_COLORS.slate, LOGO_COLORS.inkOnLight, LOGO_COLORS.inkOnDark, LOGO_COLORS.tileDark, LOGO_COLORS.tileLight]);

  it("ships the full set", () => {
    expect(files.map((f) => f.replace("public/", ""))).toEqual(expect.arrayContaining(["brand/mark-on-light.svg", "brand/mark-on-dark.svg", "brand/tile-white.svg", "brand/tile-dark.svg", "favicon.svg", "logo.svg"]));
  });

  it.each(files)("%s: only the owner's colours, no live text, no external references", (file) => {
    const svg = read(file);
    expect(svg).not.toMatch(/<text|<tspan|font-family|<script|<image|<use|<foreignObject|href=|url\(|@import|data:/i);
    // Only the favicon may carry a <style>: its one colour-scheme rule that swaps the white and dark logo.
    if (file !== "public/favicon.svg") expect(svg).not.toMatch(/<style/i);
    const colours = [...svg.matchAll(/fill(?:="|:\s*)(#[0-9a-fA-F]{3,6})/g)].map((m) => m[1].toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(allowed.has(colour as never)).toBe(true);
  });

  it("makes the favicon white on a light browser and dark on a dark one", () => {
    const svg = read("public/favicon.svg");
    expect(svg).toContain(`.t{fill:${LOGO_COLORS.tileLight}}.k{fill:${LOGO_COLORS.inkOnLight}}`);
    expect(svg).toContain(`@media (prefers-color-scheme:dark){.t{fill:${LOGO_COLORS.tileDark}}.k{fill:${LOGO_COLORS.inkOnDark}}}`);
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

describe("LogoMark and LogoBadge", () => {
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

  it("matches the badge to the theme: white logo on Pearl, dark logo on Vault", () => {
    const badge = renderToStaticMarkup(createElement(LogoBadge, { size: 40 }));
    // Tile and ink both come from theme tokens, so Pearl gets the white tile with dark ink and Vault the dark tile with white ink.
    expect(badge).toContain(`background-color:var(--logo-tile, ${LOGO_COLORS.tileLight})`);
    expect(badge).toContain(`fill:var(--logo-ink, ${LOGO_COLORS.inkOnLight})`);
    expect(badge).not.toContain("bg-white");
  });

  it("defines the theme tokens: white logo in Pearl, dark logo in Vault", () => {
    const css = read("src/index.css");
    const vaultAt = css.search(/:root\.dark,\s*:root\[data-theme="vault"\] \{/);
    expect(vaultAt).toBeGreaterThan(0);
    const pearl = css.slice(0, vaultAt);
    const vault = css.slice(vaultAt, css.indexOf(':root[data-density', vaultAt));
    expect(pearl).toContain(`--logo-ink: ${LOGO_COLORS.inkOnLight};`);
    expect(pearl).toContain(`--logo-tile: ${LOGO_COLORS.tileLight};`);
    expect(vault).toContain(`--logo-ink: ${LOGO_COLORS.inkOnDark};`);
    expect(vault).toContain(`--logo-tile: ${LOGO_COLORS.tileDark};`);
    expect(pearl).toContain(`--logo-indigo: ${LOGO_COLORS.indigo};`);
    expect(pearl).toContain(`--logo-slate: ${LOGO_COLORS.slate};`);
  });
});
