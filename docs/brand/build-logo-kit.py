#!/usr/bin/env python3
"""Builds the Ledger Tracker logo kit from the owner's supplied vector files.

Each theme comes from its own file:
  dark surfaces  -> lt02-01.svg (the transparent version with white edges)
  light surfaces -> lt04-01.svg (the transparent version with black edges; the designer left that fill unset, which SVG renders black)

Usage (from the repo root):  python3 -I docs/brand/build-logo-kit.py docs/brand/originals .
Needs rsvg-convert (librsvg) and ImageMagick (`magick`). It rewrites public/brand/*, public/favicon.svg,
public/favicon-light.svg, public/favicon-dark.svg, public/favicon.ico, public/logo.svg, public/apple-touch-icon.png
and src/components/brand/logoGeometry.ts.

Geometry and colours are parsed from the owner's files, never retyped; the two files must be the same drawing
(this script stops if they are not). Only the layout (crop, padding) is decided here. See docs/brand/README.md.
"""
import re
import tempfile
import json
import subprocess
import sys
from pathlib import Path

ORIG = Path(sys.argv[1])         # docs/brand/originals
REPO = Path(sys.argv[2])

INDIGO = "#5a5da9"               # owner's colours, exactly as in the supplied files
SLATE = "#6d7987"


def norm(colour):
    c = colour.lower()
    return "#" + "".join(ch * 2 for ch in c[1:]) if len(c) == 4 else c


def load(name):
    """The mark in one of the owner's files: its shapes by colour role, and its edge ("ink") colour.
    A shape whose class sets no fill renders black (the SVG default), exactly as in the file."""
    svg = (ORIG / name).read_text()
    fills = {}
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", svg):
        m = re.search(r"(?:^|;|\s)fill:\s*(#[0-9a-fA-F]{3,6})", body)
        if m:
            for c in sel.split(","):
                fills[c.strip().lstrip(".")] = norm(m.group(1))
    roles = {"slate": [], "indigo": [], "ink": []}
    inks = set()
    for tag, attrs in re.findall(r"<(polygon|path|rect)\b([^>]*)/>", svg):
        def attr(n):
            m = re.search(rf'(?:^|\s){n}="([^"]*)"', attrs)
            return m.group(1) if m else None
        fill = fills.get(attr("class"), "#000000")
        if tag == "polygon":
            shape = {"kind": "polygon", "points": attr("points")}
        elif tag == "path":
            shape = {"kind": "path", "d": attr("d")}
        else:
            shape = {"kind": "rect", "x": attr("x"), "y": attr("y"), "width": attr("width"), "height": attr("height")}
        if fill == SLATE:
            roles["slate"].append(shape)
        elif fill == INDIGO:
            roles["indigo"].append(shape)
        else:
            roles["ink"].append(shape)
            inks.add(fill)
    assert [len(roles[k]) for k in ("slate", "indigo", "ink")] == [2, 5, 4], {k: len(v) for k, v in roles.items()}
    assert len(inks) == 1, inks
    return roles, inks.pop()


shapes, INK_ON_DARK = load("lt02-01.svg")          # dark surfaces
light_shapes, INK_ON_LIGHT = load("lt04-01.svg")   # light surfaces
assert light_shapes == shapes, "lt02 and lt04 are not the same drawing"
assert INK_ON_DARK != INK_ON_LIGHT


def svg_shape(s, fill):
    paint = f'fill="{fill}"' if fill else 'class="k"'  # no fill = styled by the favicon's own colour-scheme rule
    if s["kind"] == "polygon":
        return f'<polygon {paint} points="{s["points"]}"/>'
    if s["kind"] == "path":
        return f'<path {paint} d="{s["d"]}"/>'
    return f'<rect {paint} x="{s["x"]}" y="{s["y"]}" width="{s["width"]}" height="{s["height"]}"/>'


def mark_body(ink):  # ink=None: the ink shapes take their colour from the svg's own style
    out = []
    for role, fill in (("slate", SLATE), ("indigo", INDIGO), ("ink", ink)):
        out += ["    " + svg_shape(s, fill) for s in shapes[role]]
    return "\n".join(out)


# ---- exact bounding box of the mark (measured from a 1:1 render of the shapes alone)
tmp = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(tempfile.mkdtemp(prefix="logo-kit-"))
probe = tmp / "probe.svg"
probe.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 1280" width="1280" height="1280">\n{mark_body("#000")}\n</svg>')
subprocess.run(["rsvg-convert", "-w", "1280", "-h", "1280", str(probe), "-o", str(tmp / "probe.png")], check=True)
bb = subprocess.run(["magick", str(tmp / "probe.png"), "-alpha", "extract", "-threshold", "0", "-format", "%@", "info:"], capture_output=True, text=True, check=True).stdout.strip()
w_s, rest = bb.split("x")
h_s, x_s, y_s = rest.replace("+", " +").replace("-", " -").split()
BX, BY, BW, BH = int(x_s), int(y_s), int(w_s), int(h_s)
print("measured bbox", BX, BY, BW, BH)
# analytic bounds (path extremes read from the shapes): x 285.35..994.14, y 229.46..876.21
AX0, AX1, AY0, AY1 = 285.35, 994.14, 229.46, 876.21
assert abs(BX - AX0) < 1.5 and abs(BX + BW - AX1) < 1.5 and abs(BY - AY0) < 1.5 and abs(BY + BH - AY1) < 1.5, "bbox mismatch"
CX, CY = (AX0 + AX1) / 2, (AY0 + AY1) / 2
MW, MH = AX1 - AX0, AY1 - AY0


def fmt(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


STYLE = (
    f"  <style>.k{{fill:{INK_ON_LIGHT}}}@media (prefers-color-scheme:dark){{.k{{fill:{INK_ON_DARK}}}}}</style>\n"
)


def transparent(ink, pad_ratio=0.06, square=0, adaptive=False):
    """The mark on a transparent ground. ink=None + adaptive: the ink follows the viewer's colour scheme."""
    pad = pad_ratio * MW
    w, h = MW + 2 * pad, MH + 2 * pad
    if square:  # a square canvas (favicons): centre the mark, same padding on the long side
        side = max(w, h)
        vb = (CX - side / 2, CY - side / 2, side, side)
    else:
        vb = (AX0 - pad, AY0 - pad, w, h)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(fmt(v) for v in vb)}" role="img" aria-label="Ledger Tracker">\n'
        f"  <title>Ledger Tracker</title>\n{STYLE if adaptive else ''}{mark_body(None if adaptive else ink)}\n</svg>\n"
    )


brand = REPO / "public" / "brand"
brand.mkdir(parents=True, exist_ok=True)
for stale in brand.glob("tile-*"):  # an earlier kit shipped tiles; the logo is transparent everywhere now
    stale.unlink()

(brand / "mark-on-light.svg").write_text(transparent(INK_ON_LIGHT))
(brand / "mark-on-dark.svg").write_text(transparent(INK_ON_DARK))
# favicon and /logo.svg are transparent and follow the viewer's colour scheme: dark ink on light, white ink on dark
(REPO / "public" / "favicon.svg").write_text(transparent(None, pad_ratio=0.02, square=1, adaptive=True))
(REPO / "public" / "logo.svg").write_text(transparent(None, adaptive=True))
# The app swaps the tab icon to match ITS theme button (Pearl or Vault), which can differ from the browser's scheme:
# favicon-light.svg = lt04 (black edges, for Pearl), favicon-dark.svg = lt02 (white edges, for Vault). Fixed ink, no <style>.
(REPO / "public" / "favicon-light.svg").write_text(transparent(INK_ON_LIGHT, pad_ratio=0.02, square=1))
(REPO / "public" / "favicon-dark.svg").write_text(transparent(INK_ON_DARK, pad_ratio=0.02, square=1))

# apple-touch-icon: iOS puts a black ground behind transparency, so this one carries the white ink
(tmp / "apple.svg").write_text(transparent(INK_ON_DARK, pad_ratio=0.1, square=1))
subprocess.run(["rsvg-convert", "-w", "180", "-h", "180", str(tmp / "apple.svg"), "-o", str(REPO / "public" / "apple-touch-icon.png")], check=True)

# PNG exports for places that cannot take SVG (slides, social, avatars)
for name in ("mark-on-light", "mark-on-dark"):
    subprocess.run(["rsvg-convert", "-w", "512", str(brand / f"{name}.svg"), "-o", str(brand / f"{name}-512.png")], check=True)

# favicon.ico: 16, 32 and 48, transparent with the dark ink (an .ico cannot follow the colour scheme; browsers use the svg)
pngs = []
for px in (16, 32, 48):
    out = tmp / f"fav-{px}.png"
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(REPO / "public" / "favicon-light.svg"), "-o", str(out)], check=True)
    pngs.append(str(out))
subprocess.run(["magick", *pngs, str(REPO / "public" / "favicon.ico")], check=True)

# ---- the React module: one source of truth for the in-app mark
pad = 0.0075 * MW  # a hair of room so antialiasing at the edge is never clipped
vbx, vby, vbw, vbh = AX0 - pad, AY0 - pad, MW + 2 * pad, MH + 2 * pad
ts = [
    "/**",
    " * The Ledger Tracker logo mark, exactly as drawn in the owner's supplied vector files.",
    " * Generated by docs/brand/build-logo-kit.py from lt02-01.svg (dark surfaces) and lt04-01.svg (light surfaces), which",
    " * are the same drawing with a different edge colour. Nothing here is redrawn. See docs/brand/README.md.",
    " */",
    "",
    f'export const LOGO_VIEWBOX = "{" ".join(fmt(v) for v in (vbx, vby, vbw, vbh))}";',
    f"export const LOGO_WIDTH = {fmt(vbw)};",
    f"export const LOGO_HEIGHT = {fmt(vbh)};",
    "",
    "/** Which of the owner's files each theme is built from. */",
    'export const LOGO_SOURCES = { light: "lt04-01.svg", dark: "lt02-01.svg" } as const;',
    "",
    "/** The owner's colours. Indigo and slate are the same on every surface; only the ink changes. */",
    "export const LOGO_COLORS = {",
    f'  indigo: "{INDIGO}",',
    f'  slate: "{SLATE}",',
    f'  inkOnLight: "{INK_ON_LIGHT}",',
    f'  inkOnDark: "{INK_ON_DARK}",',
    "} as const;",
    "",
    "export type LogoShape =",
    '  | { kind: "polygon"; points: string }',
    '  | { kind: "path"; d: string }',
    '  | { kind: "rect"; x: number; y: number; width: number; height: number };',
    "",
    "/** Drawn in this order: slate pages, indigo book and arrow, then the ink edges on top. */",
    "export const LOGO_SHAPES: Record<\"slate\" | \"indigo\" | \"ink\", readonly LogoShape[]> = {",
]
for role in ("slate", "indigo", "ink"):
    ts.append(f"  {role}: [")
    for s in shapes[role]:
        if s["kind"] == "polygon":
            ts.append(f'    {{ kind: "polygon", points: {json.dumps(s["points"])} }},')
        elif s["kind"] == "path":
            ts.append(f'    {{ kind: "path", d: {json.dumps(s["d"])} }},')
        else:
            ts.append(f'    {{ kind: "rect", x: {s["x"]}, y: {s["y"]}, width: {s["width"]}, height: {s["height"]} }},')
    ts.append("  ],")
ts.append("};")
ts.append("")
(REPO / "src" / "components" / "brand" / "logoGeometry.ts").write_text("\n".join(ts))

print(json.dumps({"mark": [round(MW, 2), round(MH, 2)], "viewBoxTight": [round(v, 2) for v in (vbx, vby, vbw, vbh)], "kit": sorted(p.name for p in brand.iterdir())}, indent=1))
