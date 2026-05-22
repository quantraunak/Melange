# Melange Design System

> Editorial · Restrained · Image-content-forward.
> The UI gets out of the way so the work shows up.

This document defines the visual language of Melange. It captures the
principles, tokens, type system, components, and patterns that make the
product feel coherent and high-craft.

The goal is not "another connecting app." It's a tool used by people with
taste. The design should communicate that — through typography, restraint,
and respect for the user's content.

---

## Principles

1. **Image content is the color.** UI chrome stays neutral and quiet so
   user-uploaded photos and event covers carry the visual weight.
2. **Editorial over UI-y.** Display type is serif (Fraunces) and large.
   Body and labels are sans (Inter). Hierarchy is loud; chrome is soft.
3. **One accent, used rarely.** Coral (`#E55A4C`) signals affirmative
   moments — likes, matches, attended events. Never decorative.
4. **Warm, not clinical.** Off-white background (`#FAFAF7`), warm borders,
   near-black ink. Never `#FFFFFF` on `#000000`.
5. **Whitespace is opinion.** Padding, line-height, and section breaks
   should feel generous, not packed.
6. **No web stock.** No pill tab bars, no gradient buttons, no rounded
   rectangle "card-in-a-card" framing. The page IS the layout.

---

## Tokens

All tokens live in `app/globals.css` under `:root`. Use the CSS variable
forms in components — they keep light/dark mode coherent.

### Color

| Token              | Value      | Usage                              |
| ------------------ | ---------- | ---------------------------------- |
| `--bg`             | `#FAFAF7`  | App background, warm off-white     |
| `--surface`        | `#FFFFFF`  | Cards, dialogs, popovers           |
| `--ink`            | `#161616`  | Primary text, primary buttons      |
| `--ink-2`          | `#555550`  | Secondary text, captions           |
| `--ink-3`          | `#9A968E`  | Tertiary text, eyebrow labels      |
| `--line`           | `#EAE7E0`  | Hairlines, borders, dividers       |
| `--secondary`      | `#F2EFE8`  | Pressed/hover states, chip bg      |
| `--accent`         | `#E55A4C`  | Like, match, RSVP-going, brand dot |
| `--accent-soft`    | `#FBE9E5`  | Accent backgrounds, badges         |
| `--success`        | `#3A7D58`  | Saved/confirmed (used sparingly)   |
| `--destructive`    | `#C5403D`  | Delete, block, report destructive  |

### Type scale

- **Display** — `Fraunces`, used for headlines, post/event titles, brand
  wordmark, profile names. Apply via `font-display` utility class.
  - Hero: `clamp(2.5rem, 5vw, 4.5rem)` (auth page hero)
  - Page title: `28–32px`
  - Section heading: `20–24px`
  - Card title: `16–22px`
- **UI / body** — `Inter`, default body face.
  - Body: `14–15px`
  - Small: `12–13px`
  - Caps label: `10–11px`, uppercase, tracking `0.12–0.18em`

### Radius

| Size      | Tailwind alias | Pixel              |
| --------- | -------------- | ------------------ |
| `--radius-sm` | `rounded-sm` | `0.5rem` (8px)  |
| `--radius-md` | `rounded-md` | `0.75rem` (12px) |
| `--radius-lg` | `rounded-lg` | `0.875rem` (14px) ← default for cards/buttons |
| `--radius-xl` | `rounded-xl` | `1.125rem` (18px) |

### Elevation

We avoid heavy shadows. Cards use a 2-layer subtle lift:

```
box-shadow:
  0 1px 2px rgba(20, 20, 18, 0.04),
  0 8px 24px -8px rgba(20, 20, 18, 0.06);
```

Exposed in CSS as the `.melange-card` utility.

---

## Components

The visual layer is built on a small set of opinionated atoms. They live
inline within feature files (`MelangeApp.tsx`, `EventsView.tsx`,
`AuthPage.tsx`) rather than in `components/ui/*` so the design intent is
preserved at the feature boundary.

### Surfaces

- `.melange-card` — soft elevated white card with hairline border.
- `.melange-input` — input with line-style focus ring (no harsh outline).
- `.melange-divider` — 1px hairline in `--line`.

### Buttons

| Variant | Use | Style |
| ------- | --- | ----- |
| Primary | Submit, publish, sign in | `bg-[var(--ink)] text-[var(--bg)]`, height 44px, radius `--radius-lg` |
| Ghost | Secondary actions in lists/cards | `border border-[var(--line)] bg-[var(--surface)]`, rounded-full or square |
| Accent | Like / I'm going (celebratory only) | `bg-[var(--accent)] text-white`, shadow `0 4px 14px rgba(229,90,76,.35)` |
| Destructive | Delete, block | `bg-[var(--destructive)] text-white` |
| Underline tab | In-card auth tabs | text + 2px underline on active |

### Patterns

- **Section header** — `SectionLabel` (caps eyebrow) + Fraunces title.
  Used at the top of every tab and dialog so users always know context.
- **Match toast** — Floating black pill with accent heart, fixed top-center.
- **Empty state** — Fraunces 24px title + body + single underline link.
- **List items** — Use `<ul>` with `divide-y divide-[var(--line)]` and
  `border-y border-[var(--line)]` for editorial lists (matches, your posts,
  blocked users). Avoid card-per-item for dense data.

---

## Layout

- **Mobile**: single column, container `max-w-[640px]` centered, side
  padding `px-5`.
- **Desktop**: same container width — the swipe card is intentionally
  not full-width because creative content reads better in a column.
  Future work may add a side-rail for desktop (events near you, recent
  matches preview).
- **Sticky chrome**: header + tab bar are sticky at `top: 0`, with a
  subtle blurred background (`backdrop-blur-md`, 92% bg).

### Don't

- Don't add another tab bar shape (pill, segment).
- Don't introduce a second accent color.
- Don't use shadcn `<Button>` for primary actions — write `PrimaryButton`
  with our tokens.
- Don't use generic stock icons inside content; lucide-react at 14–16px
  is enough.

---

## Future

Things on the design backlog:

- Light/dark mode parity audit (dark mode tokens exist but UI hasn't been
  audited image-by-image).
- Custom illustrations for empty states (currently text-only).
- An events map view for desktop.
- Per-vibe theming on individual cards (subtle border tint matching
  dominant image color).

Last updated: May 2026
