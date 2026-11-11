# Ledger Tracker logo

The logo is the owner's. The files in `originals/` are exactly what was supplied (`lt01` to `lt04`, Illustrator
exports) and are never edited. Everything else in the repo is derived from them by `build-logo-kit.py`, and
`src/components/brand/logo.test.ts` fails if the in-app mark or any shipped file drifts from them.

Open `logo-sheet.html` in a browser for the visual version of this page.

## The mark

A ledger book with a rising arrow. Three colours, 11 shapes:

| Part | Colour | Changes with the surface? |
|---|---|---|
| Book outline, arrow, ribbon | indigo `#5a5da9` | no |
| Pages | slate `#6d7987` | no |
| Page edges and base line ("ink") | `#231f20` on light, `#ffffff` on dark | **yes, this is the only thing that changes** |

The ink is the part that makes the mark visible on any ground. Wrong-way round it disappears (dark ink on the
Vault page is 1.2:1, white ink on Pearl is 1.07:1), so never pair them that way.

## Which file to use

| Where it goes | Use | Why |
|---|---|---|
| A light, flat surface (white, Pearl, paper) | `brand/mark-on-light.svg` | dark ink, transparent |
| A dark, flat surface (Vault, `#191d20`) | `brand/mark-on-dark.svg` | white ink, transparent |
| **Anything you do not control**: photos, gradients, glass, partner pages, avatars, embeds | `brand/tile-white.svg` (or `tile-dark.svg`) | carries its own background, so it is legible everywhere |
| PNG only (slides, social, avatars) | `brand/*-512.png` | same four, rasterised |
| Browser tab | `favicon.svg`, `favicon.ico` | white rounded tile, readable on light and dark tab strips |
| iOS home screen | `apple-touch-icon.png` | white, full-bleed (iOS rounds it) |
| A stable "the logo" URL | `/logo.svg` | the white tile |

Measured contrast of the bare mark (WCAG ratio; logos are exempt, but this is what "visible" means here):

| Surface | indigo | slate | ink |
|---|---|---|---|
| White / white tile | 5.88 | 4.44 | 16.30 |
| Pearl page | 5.47 | 4.13 | 15.18 |
| Vault page | 3.31 | 4.38 | 19.44 |
| Owner's dark `#191d20` | **2.89** | 3.82 | 16.96 |

Indigo on `#191d20` is just under 3:1 (it is the owner's own pairing in `lt01`), and on the Vault's glass cards the
ground is lighter than the page, so on dark glass or anything busy use the **white tile**.

## In the app

```tsx
<LogoMark size={28} />                  // tone="auto": ink follows the theme (--logo-ink in index.css)
<LogoMark tone="on-light" />            // fixed dark ink, for a light surface you control
<LogoMark tone="on-dark" />             // fixed white ink, for a dark surface you control
<LogoBadge size={36} />                 // the white tile; what every header, the sidebar and Settings use
```

Colours are tokens in `src/index.css`: `--logo-indigo`, `--logo-slate`, `--logo-ink` (dark in Pearl, white in
Vault). Do not change them: they are the owner's values. The shapes live in `src/components/brand/logoGeometry.ts`
and are generated, not hand-edited.

## Usage rules (proposed defaults, not supplied by the owner: confirm or change them)

* Do not redraw, recolour, stretch, rotate, outline, add shadows or effects to the mark. The only variable is the ink.
* Do not put the mark in a gradient or a second colour.
* Keep clear space of at least a quarter of the mark's height on every side (the standalone SVGs already include a
  small margin; add more in layouts).
* Below 24 px wide the thin edges soften (the book's page edges are about 4% of the mark's width). That is normal
  for this drawing; at tab-icon size the white tile keeps it readable. Do not thicken it.
* Never use the redrawn marks from earlier in the project: they were approximations from 64 px PNGs and have been
  replaced everywhere.

## The wordmark is not in the kit yet

The supplied files include the words "LEDGER TRACKER" as **live text in the font Satoshi Black**, with no font
embedded and no outlines. That causes two problems, so no lockup file is shipped:

1. On any machine without Satoshi installed the words render in a fallback font, with the per-letter positions
   designed for Satoshi, so the spacing breaks.
2. In all four supplied files the words are **white**, so on the two light-surface variants (`lt03` white
   background, `lt04` transparent for light surfaces) the wordmark is invisible. The light variants' edge colour
   is also an unset fill (it renders as default black); the kit uses the file's own dark, `#231f20`.

To finish the kit, ask the designer for the same four files with **text converted to outlines**, and a dark
(`#231f20`) wordmark in the two light variants. Then add a lockup row to `build-logo-kit.py`. Until then the app
sets the name next to the mark in its own type, as it always has.

## Rebuilding the kit

```
python3 -I docs/brand/build-logo-kit.py docs/brand/originals/lt01-01.svg .
```

Needs `rsvg-convert` (librsvg) and ImageMagick's `magick`. It rewrites `public/brand/*`, the favicons, `/logo.svg`,
`public/apple-touch-icon.png` and `logoGeometry.ts`. Run `pnpm test` after: the logo tests compare the result with
`originals/`.
