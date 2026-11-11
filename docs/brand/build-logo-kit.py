#!/usr/bin/env python3
"""Builds the Ledger Tracker logo kit from the owner's supplied lt01-01.svg.

Usage (from the repo root):  python3 -I docs/brand/build-logo-kit.py docs/brand/originals/lt01-01.svg .
Needs rsvg-convert (librsvg) and ImageMagick (`magick`). It rewrites public/brand/*, public/favicon.svg,
public/favicon.ico, public/logo.svg, public/apple-touch-icon.png and src/components/brand/logoGeometry.ts.

Geometry is parsed from the owner's file, never retyped. Only the layout (crop, padding, tile) and the
choice of ink colour per surface are decided here. See docs/brand/README.md.
"""
import tempfile
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(sys.argv[1])          # .../lt01-01.svg (the dark one: slate, indigo, white ink, dark bg, text)
REPO = Path(sys.argv[2])
NS = "{http://www.w3.org/2000/svg}"

INDIGO = "#5a5da9"               # owner's colours, exactly as in the supplied files
SLATE = "#6d7987"
INK_ON_LIGHT = "#231f20"         # the one dark in the owner's files (the light variants left it unset = black)
INK_ON_DARK = "#ffffff"
TILE_DARK = "#191d20"            # the owner's dark background in lt01
TILE_LIGHT = "#ffffff"           # and the white background in lt03

# ---- parse: class -> colour role in lt01
ROLE = {"cls-7": "slate", "cls-8": "indigo", "cls-5": "ink"}
tree = ET.parse(SRC)
shapes = {"slate": [], "indigo": [], "ink": []}
for el in tree.iter():
    tag = el.tag.replace(NS, "")
    role = ROLE.get(el.get("class", ""))
    if tag in ("polygon", "path", "rect") and role:
        if tag == "polygon":
            shapes[role].append({"kind": "polygon", "points": el.get("points")})
        elif tag == "path":
            shapes[role].append({"kind": "path", "d": el.get("d")})
        else:
            shapes[role].append({"kind": "rect", "x": el.get("x"), "y": el.get("y"), "width": el.get("width"), "height": el.get("height")})
assert [len(shapes[k]) for k in ("slate", "indigo", "ink")] == [2, 5, 4], {k: len(v) for k, v in shapes.items()}


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


def standalone(ink, pad_ratio=0.06):
    pad = pad_ratio * MW
    vb = (AX0 - pad, AY0 - pad, MW + 2 * pad, MH + 2 * pad)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(fmt(v) for v in vb)}" role="img" aria-label="Ledger Tracker">\n'
        f"  <title>Ledger Tracker</title>\n{mark_body(ink)}\n</svg>\n",
        vb,
    )


def tile(bg, ink, mark_ratio=0.60, size=1024, radius=0, adaptive=False):
    s = size * mark_ratio / MW
    rect = f'<rect width="{size}" height="{size}"' + (f' rx="{radius}"' if radius else "") + (' class="t"/>' if adaptive else f' fill="{bg}"/>')
    style = (
        f"  <style>.t{{fill:{TILE_LIGHT}}}.k{{fill:{INK_ON_LIGHT}}}"
        f"@media (prefers-color-scheme:dark){{.t{{fill:{TILE_DARK}}}.k{{fill:{INK_ON_DARK}}}}}</style>\n"
        if adaptive else ""
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="Ledger Tracker">\n'
        f"  <title>Ledger Tracker</title>\n{style}  {rect}\n"
        f'  <g transform="translate({fmt(size / 2)} {fmt(size / 2)}) scale({fmt(s)}) translate({fmt(-CX)} {fmt(-CY)})">\n{mark_body(ink)}\n  </g>\n</svg>\n'
    )


brand = REPO / "public" / "brand"
brand.mkdir(parents=True, exist_ok=True)

files = {}
files["mark-on-light.svg"], vb_light = standalone(INK_ON_LIGHT)
files["mark-on-dark.svg"], _ = standalone(INK_ON_DARK)
files["tile-white.svg"] = tile("#ffffff", INK_ON_LIGHT)
files["tile-dark.svg"] = tile(TILE_DARK, INK_ON_DARK)
for name, text in files.items():
    (brand / name).write_text(text)

# root assets: the favicon follows the browser's colour scheme: the white logo on a light tab strip, the dark logo on a dark one
fav = tile(TILE_LIGHT, None, mark_ratio=0.82, size=64, radius=13, adaptive=True)
(REPO / "public" / "favicon.svg").write_text(fav)
# /logo.svg stays a stable URL; it is the white tile, which is visible on any background
(REPO / "public" / "logo.svg").write_text(files["tile-white.svg"])

# apple-touch-icon: opaque, full-bleed (iOS rounds the corners itself)
(tmp / "apple.svg").write_text(tile("#ffffff", INK_ON_LIGHT, mark_ratio=0.66, size=180))
subprocess.run(["rsvg-convert", "-w", "180", "-h", "180", str(tmp / "apple.svg"), "-o", str(REPO / "public" / "apple-touch-icon.png")], check=True)

# PNG exports for places that cannot take SVG (avatars, slides, social)
for name in ("tile-white", "tile-dark"):
    subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", str(brand / f"{name}.svg"), "-o", str(brand / f"{name}-512.png")], check=True)
for name in ("mark-on-light", "mark-on-dark"):
    subprocess.run(["rsvg-convert", "-w", "512", str(brand / f"{name}.svg"), "-o", str(brand / f"{name}-512.png")], check=True)

# favicon.ico: 16, 32 and 48, always the white logo (an .ico cannot follow the colour scheme)
(tmp / "favicon-light.svg").write_text(tile(TILE_LIGHT, INK_ON_LIGHT, mark_ratio=0.82, size=64, radius=13))
pngs = []
for px in (16, 32, 48):
    out = tmp / f"fav-{px}.png"
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(tmp / "favicon-light.svg"), "-o", str(out)], check=True)
    pngs.append(str(out))
subprocess.run(["magick", *pngs, str(REPO / "public" / "favicon.ico")], check=True)

# ---- the React module: one source of truth for the in-app mark
pad = 0.0075 * MW  # a hair of room so antialiasing at the edge is never clipped
vbx, vby, vbw, vbh = AX0 - pad, AY0 - pad, MW + 2 * pad, MH + 2 * pad
ts = [
    "/**",
    " * The Ledger Tracker logo mark, exactly as drawn in the owner's supplied vector files (lt01 to lt04).",
    " * Generated from lt01-01.svg: the shapes are the owner's, nothing here is redrawn. See docs/brand/README.md.",
    " */",
    "",
    f'export const LOGO_VIEWBOX = "{" ".join(fmt(v) for v in (vbx, vby, vbw, vbh))}";',
    f"export const LOGO_WIDTH = {fmt(vbw)};",
    f"export const LOGO_HEIGHT = {fmt(vbh)};",
    "",
    "/** The owner's colours. Indigo and slate are the same on every surface; only the ink changes. */",
    "export const LOGO_COLORS = {",
    f'  indigo: "{INDIGO}",',
    f'  slate: "{SLATE}",',
    f'  inkOnLight: "{INK_ON_LIGHT}",',
    f'  inkOnDark: "{INK_ON_DARK}",',
    f'  tileDark: "{TILE_DARK}",',
    f'  tileLight: "{TILE_LIGHT}",',
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
