# Melange Design System — iOS

> Light. Paper, ink, one accent. Opaque content, glass chrome.
> The photograph is the thing; the app gets out of its way.

This document describes the **mobile app**, which is the product. It replaces
an earlier version that specified a warm off-white ground, a coral accent and
tokens living in a web stylesheet — none of which were ever implemented, and
not one of whose values matched the app. That mismatch is worth naming,
because it caused everything else: when nothing decides globally, every screen
decides locally, and you end up with five tab-bar heights, four gutters down
one screen and three sizes for one rank of heading.

Tokens live in `mobile/src/lib/theme.ts` and that file is the authority. The
numbers below are copied from it. If the two ever disagree, the code wins and
this document is stale.

The full audit this came from, including the measurements behind each value,
is in `docs/DESIGN_SPEC.md`.

---

## Principles

1. **The image is the content.** Chrome stays quiet so user photographs carry
   the visual weight. Nothing washes over a photo to make text easier; the
   text gets its own opaque surface instead.
2. **Content is opaque and edge to edge. Chrome floats inset and is glass.**
   This is the one structural rule, and the Discover plate states it.
3. **Paper, ink, one accent.** Off-white paper, white surfaces, near-black
   ink. Indigo is for links and the one primary action per screen. "Yes"
   states (liked, matched, selected) are ink, not a second hue. Red exists
   only to confirm something destructive. No gradients, ever; see
   `.claude/skills/melange-design/SKILL.md`.
4. **Light only.** There is no dark theme, and "glass" never means dark
   chrome. A black scrim over the bottom of a photograph is dark chrome no
   matter which layer it lives in.
5. **One of everything.** One gutter, four radii, nine type tokens, three
   elevations, one spacing scale. A value that is not on a scale is a bug.
6. **Weight comes from the family, not a number.** `fontWeight` is banned by
   ESLint, as is `fontSize` outside `theme.ts`.

---

## Color

| Token | Value | Job |
| --- | --- | --- |
| `bg` | `#fafaf7` | paper: the app ground |
| `surface` | `#ffffff` | tappable cards, sheets |
| `surfaceSunken` | `#f3f3ef` | input wells, empty photo slots |
| `line` | `rgba(20,20,20,0.10)` | every hairline |
| `lineStrong` | `#e4e4de` | input wells, disabled outlines |
| `text` | `#141414` | body and titles |
| `textSecondary` | `#4a4a46` | descriptions, metadata |
| `textTertiary` | `#6b6b66` | timestamps, hints — **on white only** |
| `iconFaint` | `#a3a39c` | strokes, dividers. **Never text.** |
| `brand` / `brandText` | `#3730a3` | indigo: links and the one primary action |
| `accent` / `accentInk` | `#141414` | liked, matched, selected — ink |
| `accentSoft` | `#eeeee9` | selected chip ground |
| `danger` | `#dc2626` | destructive confirmation only |

## Spacing, gutter, radii

```ts
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 }
GUTTER  = 16     // every screen edge
radii   = { sm: 6, md: 8, lg: 10, photo: 2, pill: 999 }
```

`sm` chips, inputs · `md` buttons · `lg` tappable cards, sheets, the tab bar ·
`photo` images · `pill` circles only (avatars, round controls).

No placeholder art. A missing photo is a type-only block: the title in the
display serif on paper. Cards are only for tappable things that move (a
night, a person, a tile); everything else sits on the page, separated by
space and hairline rules.

The Discover plate is the single deliberate exception to the gutter: it sits
at 0 and runs to both screen edges. That is the signature, not an oversight.

## Type

Fraunces 600 for display, Inter 400/500/600 for text, Inter 700 for `eyebrow`
alone. Three weights in the whole product.

| Token | Family | Size / line-height | Used for |
| --- | --- | --- | --- |
| `display1` | Fraunces 600 | 36 / 40 | page titles |
| `display2` | Fraunces 600 | 26 / 30 | content titles |
| `title` | Inter 600 | 20 / 26 | feed card titles |
| `headline` | Inter 600 | 17 / 22 | section headings, row titles |
| `body` | Inter 400 | 15 / 23 | all prose |
| `bodyStrong` | Inter 600 | 15 / 23 | names, values |
| `caption` | Inter 400 | 13 / 18 | secondary metadata |
| `micro` | Inter 500 | 11 / 14 | timestamps, counts, tab labels |
| `eyebrow` | Inter 700 | 11 / 13, uppercase | section eyebrows |

`caption`, `micro` and `eyebrow` carry `tabular-nums` so metadata columns stop
jittering.

## Material

Glass appears in exactly two places: circular controls floating over a
photograph, and the tab bar. Everything else is opaque.

```ts
glass = {
  tint: "systemThinMaterialLight",
  intensity: 60,
  tintLayer: "rgba(255,255,255,0.42)",
  rim: "rgba(17,24,39,0.12)",
}
```

The rim is a dark hairline. A white rim reads crisply where the photo behind
is dark and disappears where it is bright, so it only ever works on half an
image.

## Elevation

Shadows almost never. `card` and `plate` are zero; `float` is a faint lift
for glass controls sitting on a photograph. Surfaces get a hairline edge.

## Motion

```ts
springs:   press / snap / promote / celebrate
durations: instant 90 · quick 180 · base 240 · slow 320
easings:   enter · exit · standard
press:     circle 0.90 · card 0.975 · wide 0.97
```

Exactly one bouncy spring exists in the app and it belongs to the match.

Haptics, one per meaning: `tap` Light · `commit` Medium · `reject` Rigid ·
`step` selection · `win` Success · `fail` Error. They fire on `onPressIn`,
never on `onPressOut`, and never from an animation completion callback — a
buzz that lands after the finger has left reads as lag.

## Tab bar

```ts
TAB_BAR_H = 67
useBarTop() = max(insets.bottom, 12) + TAB_BAR_H
```

Every screen imports `useBarTop()`. Floating elements sit at `barTop + 20`;
scroll content gets `paddingBottom: barTop + 24`.

The bar is labelled. Discover and Stories are product-specific ideas with no
conventional glyph, so an icon cannot carry them alone. Selection is the icon
and label turning ink; there is no sliding indicator.

## Don't

- No dark theme, and no dark scrim over a photograph.
- No second accent colour: indigo is the only one.
- No `fontSize` or `fontWeight` outside `theme.ts` (ESLint enforces both).
- No card inside a card. Separate sections with space and a rule.
- No sliding pill indicator in the tab bar. (The floating bar itself stays —
  this overturns the previous version of this document, which banned pill tab
  bars outright. The bar is the best idea in the design; the indicator inside
  it was Material Design's.)
- No negative margins clawing back a container's gap. Set the gap correctly.
