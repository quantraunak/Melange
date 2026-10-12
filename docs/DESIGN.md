# Melange Design System — iOS

> Light. Two hues. Opaque content, glass chrome.
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
3. **Two hues.** Blue is structure — wordmark, navigation, primary buttons,
   links. Violet is affirmative — like, match, selected. There is no third.
   Red exists only to confirm something destructive.
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
| `bg` | `#f3f4f6` | app ground |
| `surface` | `#ffffff` | plates, cards, sheets |
| `surfaceSunken` | `#f9fafb` | input wells only |
| `line` | `rgba(17,24,39,0.10)` | every hairline |
| `lineStrong` | `#e5e7eb` | input wells, disabled outlines |
| `text` | `#111827` | body and titles |
| `textSecondary` | `#4b5563` | descriptions, metadata (6.87:1 on bg) |
| `textTertiary` | `#6b7280` | timestamps, hints — **on white only** |
| `iconFaint` | `#9ca3af` | strokes, dividers, placeholder glyphs. **Never text.** |
| `brand` | `#1e3a8a` | structure |
| `brandText` | `#1d4ed8` | text links only |
| `accent` | `#7c3aed` | like, match, selected — and nothing else |
| `accentSoft` | `#f5f3ff` | selected chip ground |
| `accentInk` | `#6d28d9` | accent text on light |
| `danger` | `#dc2626` | destructive confirmation only |

`textTertiary` on `bg` measures 4.39:1 and fails AA, which is why secondary
text is `#4b5563` and `#6b7280` is confined to white surfaces.

## Spacing, gutter, radii

```ts
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 }
GUTTER  = 16     // every screen edge
radii   = { sm: 12, md: 16, lg: 24, pill: 999 }
```

`sm` chips, inputs, thumbnails · `md` inner cards · `lg` plates, sheets, the
tab bar · `pill` capsules and circles. Where a shape nests inside another,
`inner = outer − padding`.

The Discover plate is the single deliberate exception to the gutter: it sits
at 0 and runs to both screen edges. That is the signature, not an oversight.

## Type

Fraunces 600 for display, Inter 400/500/600 for text, Inter 700 for `eyebrow`
alone. Three weights in the whole product.

| Token | Family | Size / line-height | Used for |
| --- | --- | --- | --- |
| `display1` | Fraunces 600 | 32 / 36 | page titles |
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

`card` for resting surfaces, `plate` for the Discover plate and sheets,
`float` for anything over a photograph. `float` is the only one with enough
weight to read on an image. A surface has an edge **or** a shadow, never both.

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
and label turning `brand`; there is no sliding indicator.

## Don't

- No dark theme, and no dark scrim over a photograph.
- No third accent colour.
- No `fontSize` or `fontWeight` outside `theme.ts` (ESLint enforces both).
- No card inside a card. Separate sections with space and a rule.
- No sliding pill indicator in the tab bar. (The floating bar itself stays —
  this overturns the previous version of this document, which banned pill tab
  bars outright. The bar is the best idea in the design; the indicator inside
  it was Material Design's.)
- No negative margins clawing back a container's gap. Set the gap correctly.
