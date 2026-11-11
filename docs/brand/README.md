# Ledger Tracker logo

The logo is the owner's. The files in `originals/` are exactly what was supplied (`lt01` to `lt04`, Illustrator
exports) and are never edited. **Each theme is built from its own file: dark surfaces from `lt02` (transparent, white edges), light surfaces from
`lt04` (transparent, black edges).** Everything else in the repo is derived from them by `build-logo-kit.py`, and
`src/components/brand/logo.test.ts` fails if the in-app mark or any shipped file drifts from them.

Open `logo-sheet.html` in a browser for the visual version of this page.

## The mark

A ledger book with a rising arrow. Three colours, 11 shapes:

| Part | Colour | Changes with the surface? |
|---|---|---|
| Book outline, arrow, ribbon | indigo `#5a5da9` | no |
| Pages | slate `#6d7987` | no |
| Page edges and base line ("ink") | `#000000` on light (from `lt04`), `#ffffff` on dark (from `lt02`) | **yes, this is the only thing that changes** |

The ink is the part that makes the mark visible on any ground. Wrong-way round it disappears (black ink on the
Vault page is 1.08:1, white ink on Pearl is 1.07:1), so never pair them that way.

## Which file to use

The logo is **always the transparent mark, never on a tile or a coloured box**. Only the ink changes with the surface.

| Where it goes | Use | Ink |
|---|---|---|
| A light surface (white, Pearl) | `brand/mark-on-light.svg` (from `lt04`) | black `#000000` |
| A dark surface (Vault, `#191d20`) | `brand/mark-on-dark.svg` (from `lt02`) | white |
| The app (every theme) | `<Logo />` | follows the theme: dark on Pearl, white on Vault |
| PNG only (slides, social, avatars) | `brand/mark-on-light-512.png`, `brand/mark-on-dark-512.png` | as named |
| Browser tab | `favicon.svg` (transparent, follows the browser's light or dark scheme), `favicon.ico` (fallback, black ink) | scheme |
| A stable "the logo" URL | `/logo.svg` (transparent, follows the viewer's scheme) | scheme |
| iOS home screen | `apple-touch-icon.png` (white ink; iOS puts a black ground behind transparency) | white |

Measured contrast of the bare mark (WCAG ratio; logos are exempt, but this is what "visible" means here):

| Surface | indigo | slate | ink |
|---|---|---|---|
| White | 5.88 | 4.44 | 21.00 (black ink) |
| Pearl page | 5.47 | 4.13 | 19.56 (black ink) |
| Vault page | 3.31 | 4.38 | 19.44 (white ink) |
| Owner's dark `#191d20` | **2.89** | 3.82 | 16.96 (white ink) |

Indigo on `#191d20` is just under 3:1 (it is the owner's own pairing in `lt01`, their dark-background file). On a very busy picture or a mid-tone
ground the mark can lose parts, so pick the ink that contrasts and keep the ground calm behind it.

## In the app

```tsx
<Logo size={36} />                      // every brand spot: transparent, ink follows the theme (--logo-ink in index.css)
<LogoMark tone="on-light" />            // fixed black ink, for a light surface you control
<LogoMark tone="on-dark" />             // fixed white ink, for a dark surface you control
```

Colours are tokens in `src/index.css`: `--logo-indigo`, `--logo-slate`, `--logo-ink` (dark in Pearl, white in Vault).
Do not change them: they are the owner's values. The shapes live in `src/components/brand/logoGeometry.ts` and are
generated, not hand-edited.

## Usage rules (proposed defaults, not supplied by the owner: confirm or change them)

* Do not redraw, recolour, stretch, rotate, outline, add shadows or effects to the mark. The only variable is the ink.
* Do not put the mark in a gradient, a second colour, or on a tile or box.
* Keep clear space of at least a quarter of the mark's height on every side (the standalone SVGs already include a
  small margin; add more in layouts).
* Below 24 px wide the thin edges soften (the book's page edges are about 4% of the mark's width). That is normal
  for this drawing. Do not thicken it.
* Never use the redrawn marks from earlier in the project: they were approximations from 64 px PNGs and have been
  replaced everywhere.

## The wordmark is not in the kit yet

The supplied files include the words "LEDGER TRACKER" as **live text in the font Satoshi Black**, with no font
embedded and no outlines. That causes two problems, so no lockup file is shipped:

1. On any machine without Satoshi installed the words render in a fallback font, with the per-letter positions
   designed for Satoshi, so the spacing breaks.
2. In all four supplied files the words are **white**, so on the two light-surface variants (`lt03` white
   background, `lt04` transparent for light surfaces) the wordmark is invisible. The light variants' edge colour
   is also an unset fill, which renders as default black, so the light logo is pure black, exactly as `lt04` renders.

To finish the kit, ask the designer for the same four files with **text converted to outlines**, and a dark
(`#000000`, to match the mark) wordmark in the two light variants. Then add a lockup row to `build-logo-kit.py`. Until then the app
sets the name next to the mark in its own type, as it always has.

## Rebuilding the kit

```
python3 -I docs/brand/build-logo-kit.py docs/brand/originals .
```

Needs `rsvg-convert` (librsvg) and ImageMagick's `magick`. It rewrites `public/brand/*`, the favicons, `/logo.svg`,
`public/apple-touch-icon.png` and `logoGeometry.ts`. Run `pnpm test` after: the logo tests compare the result with
`originals/`.
