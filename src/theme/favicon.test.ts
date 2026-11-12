import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyFavicon, faviconHref } from "./favicon";

/** The smallest stand-in for a document that holds one icon link. */
function fakeDocument(initialHref: string | null) {
  const attrs = new Map<string, string>(initialHref === null ? [] : [["href", initialHref]]);
  const link = { getAttribute: (n: string) => attrs.get(n) ?? null, setAttribute: (n: string, v: string) => void attrs.set(n, v) };
  const calls: string[] = [];
  const doc = {
    querySelector: (selector: string) => {
      calls.push(selector);
      return initialHref === null ? null : link;
    },
  } as unknown as Document;
  return { doc, attrs, calls };
}

describe("faviconHref", () => {
  it("uses the white-edged mark for Vault and the black-edged mark for Pearl", () => {
    expect(faviconHref("vault")).toBe("/favicon-dark.svg");
    expect(faviconHref("paper")).toBe("/favicon-light.svg");
  });

  it("points at files that are really shipped", () => {
    for (const theme of ["vault", "paper"] as const) {
      expect(existsSync(resolve(__dirname, "../../public", faviconHref(theme).slice(1)))).toBe(true);
    }
  });
});

describe("applyFavicon", () => {
  it("retargets the page's SVG icon link to the current theme", () => {
    const { doc, attrs, calls } = fakeDocument("/favicon.svg?v=3");
    applyFavicon("vault", doc);
    expect(attrs.get("href")).toBe("/favicon-dark.svg");
    applyFavicon("paper", doc);
    expect(attrs.get("href")).toBe("/favicon-light.svg");
    expect(calls[0]).toBe('link[rel="icon"][type="image/svg+xml"]'); // never touches the .ico or apple-touch-icon links
  });

  it("is a no-op when the link already matches, and when there is no link", () => {
    const { doc, attrs } = fakeDocument("/favicon-dark.svg");
    applyFavicon("vault", doc);
    expect(attrs.get("href")).toBe("/favicon-dark.svg");
    expect(() => applyFavicon("paper", fakeDocument(null).doc)).not.toThrow();
  });
});
