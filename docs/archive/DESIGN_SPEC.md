<!-- Generated 2026-10-11 by an adversarial 7-lens design teardown. Exact values; implement literally. -->

# Melange iOS — design audit and system rebuild

**Scope:** `product/stories-and-fullbleed`. Eight screenshots at 1320×2868 (iPhone 16 Pro Max, 440×956pt @3x, `insets.top` 62, `insets.bottom` 34), read against `mobile/src/lib/theme.ts`, `SwipeCard.tsx`, `components/ui/*`, `(tabs)/_layout.tsx`, `(tabs)/connect.tsx`, `(tabs)/stories.tsx`, `(tabs)/profile.tsx`, `app/post/[id].tsx`, `app/story/[id].tsx`, `StoryForm.tsx` and `docs/DESIGN.md`.

> Note on paths: the worktree `/.claude/worktrees/agent-a08cc4aeae75e8abb` was deleted mid-review. Every file reference below is the repo-relative path on branch `product/stories-and-fullbleed` (read via `git show product/stories-and-fullbleed:<path>`). All line numbers are from that branch.

---

## 1. The diagnosis

The app has a token file but no design system: `theme.ts` declares an 8pt spacing scale that almost nothing imports, a radii scale that 18 separate literal `borderRadius` values ignore, and a type block with no `fontFamily` in it at all — `grep -rn "fontFamily\|useFonts\|expo-font" mobile/` returns zero hits, so every headline in the product is iOS San Francisco bulked to weight 800, which is the precise visual default of generated UI. Because nothing governs globally, every screen solved its own problems locally: five different hardcoded clearances for one tab bar (92, 112, 112, 150, 120), four different horizontal gutters stacked vertically on the single most important screen, 17 distinct `fontSize` literals across 134 call sites, and six saturated hues live simultaneously on Discover in an app whose own `docs/DESIGN.md` says "one accent, used rarely." The owner's "the likes are hidden" is not a perception problem — it is arithmetic: the tab bar is 95pt tall and the action row is pinned at `bottom: 92`, so the two primary verbs of a swipe app are tucked 3pt under the navigation, with the Undo control rendered at `opacity: 0.5` on top of a `#d1d5db` glyph over a frosted white disc, which is 1.47:1 and genuinely not findable.

---

## 2. The design system

These values replace `mobile/src/lib/theme.ts` wholesale. Every number is absolute. Nothing below is a suggestion.

### 2.1 Color

Light only. Two hues: **blue = structure, violet = affirmative.** There is no third. Green, amber, indigo and red-as-UI are deleted; red survives only as `danger` for destructive confirmation dialogs.

| Token | Value | Job | Contrast |
|---|---|---|---|
| `bg` | `#f3f4f6` | app ground | — |
| `surface` | `#ffffff` | plates, cards, sheets | — |
| `surfaceSunken` | `#f9fafb` | input wells only | — |
| `line` | `rgba(17,24,39,0.10)` | every hairline, at `StyleSheet.hairlineWidth` | — |
| `lineStrong` | `#e5e7eb` | input wells, disabled outlines | — |
| `text` | `#111827` | body, titles | 14.9:1 on bg |
| `textSecondary` | `#4b5563` | loglines, descriptions, metadata | **6.87:1 on bg** |
| `textTertiary` | `#6b7280` | timestamps, hints — **only on `#ffffff`** | 4.83:1 on white, 4.39 on bg → banned on bg |
| `iconFaint` | `#9ca3af` | non-text strokes, dividers, placeholder glyphs. **Never a text color.** | — |
| `brand` | `#1e3a8a` | primary buttons, wordmark, selected nav | white on it = 10.36:1 |
| `brandText` | `#1d4ed8` | text links only | — |
| `accent` | `#7c3aed` | like, match, selected, and nothing else | white on it = 5.70:1 |
| `accentSoft` | `#f5f3ff` | selected chip ground | — |
| `accentInk` | `#6d28d9` | accent text on light | 5.98:1 on accentSoft |
| `danger` | `#dc2626` | destructive confirmation only | — |
| `onBrand` / `onAccent` | `#ffffff` | — | — |

**Delete from the file:** `like`, `likeSoft`, `pass`, `passText`, `warning`, `success`, `successSoft`, `brandTabBg`, `brandOutline`, `brandSoft`, `textFaint`, `highlight`. `textFaint` (`#d1d5db`) is gray-300 — a border value currently used as type at `StoryForm.tsx:532` and `connect.tsx:301`; it must not exist as a color token at all.

### 2.2 Spacing

```ts
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const GUTTER = 16;
```

One gutter, 16, for every screen edge. No value off this scale anywhere. Current offenders to snap, by count: `gap: 6` (22 uses) → 8, `gap: 10` (22 uses) → 12, `gap: 14` (12 uses) → 16, `gap: 5` (7) → 4, `gap: 2` (4) → 0, `gap: 7/9/11/18` (9 total) → 8/8/12/16.

### 2.3 Radii — four values, no others

```ts
export const radii = { sm: 12, md: 16, lg: 24, pill: 999 };
```

`sm 12` chips, inputs, thumbnails. `md 16` inner cards. `lg 24` plates, sheets, the tab bar. `pill 999` capsules and circles. **Delete `28`** (three uses: `SwipeCard.card`, `story/[id].body`, `post/[id].applyBtn`) — the plate and the tab bar both go to 24 so they share one curve. Concentric rule where a shape nests: `inner = outer − padding`. The tab bar pill, if it survives, is `24 − 6 = 18`, not `radii.xl` (20).

### 2.4 Type — ship a typeface

`npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/inter`, load in `mobile/app/_layout.tsx` behind `SplashScreen.preventAutoHideAsync()`.

| Role | Family | Size | Line-height | Tracking | Used for |
|---|---|---|---|---|---|
| `display1` | `Fraunces_600SemiBold` | 32 | 36 | −0.8 | tab-level page titles: "Stories", "You" |
| `display2` | `Fraunces_600SemiBold` | 26 | 30 | −0.5 | content titles: Discover plate, story detail, project detail |
| `title` | `Inter_600SemiBold` | 20 | 26 | −0.2 | feed card titles |
| `headline` | `Inter_600SemiBold` | 17 | 22 | −0.1 | section headings, row titles, modal titles |
| `body` | `Inter_400Regular` | 15 | 23 | 0 | all prose |
| `bodyStrong` | `Inter_600SemiBold` | 15 | 23 | 0 | names, values |
| `caption` | `Inter_400Regular` | 13 | 18 | +0.1 | secondary metadata |
| `micro` | `Inter_500Medium` | 11 | 14 | +0.2 | timestamps, counts |
| `eyebrow` | `Inter_700Bold` | 11 | 13 | +1.65 (= 0.15em), uppercase | the two surviving eyebrows only |

Rules, enforced: **three weights total** — Fraunces 600 for display, Inter 400/500/600 for text, Inter 700 reserved for `eyebrow` alone. `fontWeight: "800"` and `"900"` are deleted from the repo (`SwipeCard.tsx:423`, `stories.tsx:258`, `profile.tsx:701`, `post/[id].tsx:392`, `_layout.tsx:196`, `StoryForm.tsx:600`). Every token carries `lineHeight` — four currently do not (`h2`, `h3`, `tiny`, `eyebrow`), which means RN falls back to SF's ~1.19 metric leading nobody chose. Add `fontVariant: ["tabular-nums"]` to `caption`, `micro` and `eyebrow` so metadata columns and count badges stop jittering. Then add an ESLint `no-restricted-syntax` rule banning the `fontSize` property outside `theme.ts`: there are currently **134 literals across 17 sizes** (13×31, 12×18, 11×16, 14×15, 16×13, 15×13, 10×6, 9, 17, 18, 22, 24, 26, 28, 30, 34, 40), and 12/14/17 are not even tokens.

### 2.5 Material — glass is for controls, white is for content

The current recipe is three white layers stacked: `BlurView intensity={50} tint="light"` (which on iOS is `UIBlurEffectStyleLight`, already a white veil), plus `rgba(255,255,255,0.78)` on top of it, plus a 340pt `Fade` washing the photo to 0.5 white underneath. ~22% of the backdrop survives. Screenshot 02 at 3× proves it: there is zero recoverable image structure in the plate, and no trace of the tungsten fixture blowing out four inches above it. It is a flat taupe slab.

```ts
export const glass = {
  tint: "systemThinMaterialLight" as const,
  intensity: 60,          // floating controls over photography
  tintLayer: "rgba(255,255,255,0.42)",
  rim: "rgba(17,24,39,0.12)",   // hairline, survives bright AND dark photos
  specular: "rgba(255,255,255,0.80)",
};
```

Glass is used in **exactly two places**: the circular `GlassButton`s floating over a photo, and the tab bar. Content surfaces are opaque `#ffffff`. A uniform white rim on four sides is a CSS habit, not a material — screenshot 02 shows it crisp top-left where the photo is dark and gone along the bottom where the floor is bright. Use a dark hairline, and inset the specular highlight `left: 24, right: 24` so the 24pt corner clip stops eating its terminals.

### 2.6 Elevation — three levels

```ts
export const shadows = {
  card:  { shadowColor: "#111827", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },  elevation: 2 },
  plate: { shadowColor: "#111827", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },  elevation: 4 },
  float: { shadowColor: "#0b1220", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
};
```

`float` is the only shadow allowed over a photograph — the current `shadows.soft` (0.06 / 8 / 2) is below the perceptual floor on an image, which is why all three action circles in screenshot 01 sit flat on the brick. **`shadows.glow` is deleted** (`theme.ts:134–140`): a `#22c55e` shadow at 0.30/14 on a light-gray ground renders as a visible green bloom, which is a 2015 Dribbble artifact. A card has an edge *or* a shadow, never both: when `elevated`, `Glass.tsx` sets `borderWidth: 0`.

### 2.7 Motion — the layer that does not currently exist

`grep -i "motion\|spring\|easing\|haptic" docs/DESIGN.md` returns nothing, and the app contains 12 unrelated spring configs and press scales of 0.93, 0.97, 0.975 and 0.995.

```ts
import { Easing } from "react-native-reanimated";
export const motion = {
  springs: {
    press:     { damping: 26, stiffness: 420, mass: 0.7 },
    snap:      { damping: 22, stiffness: 260, mass: 0.9 },
    promote:   { damping: 24, stiffness: 300, mass: 1.0 },
    celebrate: { damping: 15, stiffness: 190, mass: 0.9 },  // the only bouncy spring in the app
  },
  durations: { instant: 90, quick: 180, base: 240, slow: 320 },
  easings: {
    enter:    Easing.bezier(0.16, 1, 0.3, 1),
    exit:     Easing.bezier(0.4, 0, 1, 1),
    standard: Easing.bezier(0.2, 0, 0, 1),
  },
  press: { circle: 0.90, card: 0.975, wide: 0.97 },
};
```

Haptic map, one per meaning: `tap: Light` · `commit: Medium` · `reject: Rigid` · `step: selectionAsync` · `win: NotificationFeedbackType.Success` · `fail: NotificationFeedbackType.Error`. Pass is `Rigid`, not `Light` — `Light` currently reads as a weak Medium rather than a different answer. Haptics fire on `onPressIn`, never `onPressOut`, and never from an animation completion callback.

### 2.8 Tab bar geometry — one exported constant

```ts
// (tabs)/_layout.tsx
export const TAB_BAR_H = 67;   // 8 pad + 21 icon + 3 gap + 13 label + 8 pad + 12 (TAB_BAR_PAD×2) + 2 border
export function useBarTop() { return Math.max(useSafeAreaInsets().bottom, 12) + TAB_BAR_H; }
```

Every screen imports `useBarTop()`. Floating elements sit at `barTop + 20`; scroll content gets `paddingBottom: barTop + 24`. All five literals (`connect.tsx:30` = 92, `stories.tsx:25` = 112, `messages.tsx:32` = 112, `profile.tsx:647` = 150, `events/index.tsx:349` = 120) are deleted.

---

## 3. The signature idea: **the plate**

Kill the floating rounded-rectangle-over-a-photo and replace it with a **plate**: one opaque white surface, flush to the left and right screen edges with squared bottom corners and 24pt top corners, pinned above the tab bar, carrying both the caption *and* the two verbs — Pass and Like live inside it, on white, separated from the caption by a full-bleed hairline. This states a rule the app currently cannot state: *content goes edge-to-edge and is opaque; chrome floats inset at 16 and is glass* — so a user always knows what is the work and what is the app, and the "glass" material stops being an excuse for stacking white until text passes contrast. It is pure React Native layout (no new dependency, no masking), it is light-palette by construction, and it solves the owner's complaint structurally rather than cosmetically: the Like button becomes a 64pt violet disc on white at 5.70:1 that cannot collide with the navigation, instead of a green circle fused into the tab bar over a sand-colored floor.

With the plate opaque, the 340pt white `Fade` is deleted outright — the photograph keeps its full density and chroma down to the plate's top edge, which is exactly what `DESIGN.md` principle 1 asks for and the opposite of what ships.

---

## 4. Prioritised fixes

The first five close most of the gap.

### 1 — FATAL · Discover: the action row collides with the tab bar, and Undo is invisible
**Screen:** Discover (01). **Files:** `mobile/app/(tabs)/connect.tsx:30–33, 293–330, 353–362`; `mobile/app/(tabs)/_layout.tsx`.

The bar's real height is `max(insets.bottom,12) + 6 + 12 + 23 + 12 + 6 + 2` = **95pt**. The row is at `bottom: 92`. Three points. The green disc's `shadows.glow` (r14, y+6) bleeds 20pt straight through it, which is why the disc and the bar visibly fuse in the screenshot. On a 0-inset SE the same row floats 19pt clear, so the composition is different on every handset.

| | Before | After |
|---|---|---|
| `TAB_BAR_CLEARANCE` | `= 92` (hardcoded) | deleted; `const barTop = useBarTop()` → 101 |
| `styles.actions` bottom | `92` | `barTop + 20` → **121** |
| `PANEL_INSET` | `92 + 64 + 12` = 168 | `barTop + 16` → **117** (plate bottom; see fix 3) |
| Undo disabled | `styles.dim` (`opacity: 0.5`) + icon `#d1d5db` (1.47:1) | `styles.dim` **deleted**; render nothing when `!lastSwipe` — `{lastSwipe ? <GlassButton …/> : <View style={{ width: 48 }} />}`, mounted with `entering={FadeIn.duration(180)}` |
| Undo icon enabled | `colors.warning` `#f59e0b` (2.15:1) | `colors.text` `#111827` |
| Pass icon | `colors.passText` `#dc2626`, `strokeWidth 2.75` | `#111827`, `strokeWidth 2` — a pass is not an error |
| Like fill | `colors.like` `#22c55e` + `shadows.glow` | `colors.accent` `#7c3aed` + `shadows.float`; heart rendered **filled** (`fill="#fff" stroke="none"`), not a 2.75pt outline at 2.28:1 |
| `GlassButton` hitSlop | none (42pt controls, under the 44pt floor) | `hitSlop={10}` on the Pressable; search/post `size={44}` |

### 2 — FATAL · The app has no typeface
**Screens:** all. **File:** `mobile/src/lib/theme.ts:80–113`, `mobile/app/_layout.tsx`.

`grep` returns zero `fontFamily`. Every headline is SF pushed to 800 with −0.6 tracking; `docs/DESIGN.md` §Principles.2 specifies Fraunces display + Inter text and has never been implemented in any form. SF Heavy at 30px closes its counters and blunts its terminals — "Stories", "You", "What did you make?" and the Discover title all read as shouting button labels. This is the first thing a designer does on a creative product and the single highest-leverage change in this list.

Install and load per §2.4, then replace the `typography` export with the nine tokens and delete all 134 call-site literals. Specific contradictions to remove: `profile.tsx:650` `{...typography.display, fontSize: 28}` (inherits `lineHeight: 34`, so "You" is 28/34 while "Stories" is 30/34); `story/[id].tsx:297` and `post/[id].tsx:352` `{...typography.display, fontSize: 26, lineHeight: 31}`. Three sizes for one rank, each written as an override of the token it imported.

### 3 — FATAL · Discover: build the plate; delete the triple white stack and the banded gradient
**Screen:** Discover (01, 02). **Files:** `mobile/src/components/SwipeCard.tsx:104–177, 425–457`; `mobile/src/components/ui/Fade.tsx`.

| | Before | After |
|---|---|---|
| `panelWrap` | `left: 0, right: 0, bottom: PANEL_INSET` | same, `bottom: barTop + 16` |
| `panelPress` | `paddingHorizontal: 10` | `paddingHorizontal: 0` — the plate is edge-to-edge |
| `panelClip` | `borderRadius: radii.xxl` (24) all corners, `borderWidth: 1` `rgba(255,255,255,0.7)`, `shadows.soft` | `borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0`; `borderWidth: 0`; `borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line`; move `shadows.plate` onto a new **unclipped** wrapper (a shadow on a view carrying `overflow: "hidden"` is drawn as a clipped rect on Android) |
| `BlurView` + `panelTintLayer` | `intensity 50` + `rgba(255,255,255,0.78)` | **both deleted** — `backgroundColor: "#ffffff"` |
| `panelHighlight` | `top:0, left:0, right:0` inside a 24pt clip | deleted (opaque plate needs no specular) |
| `styles.panel` | `padding: 16, paddingTop: 14, gap: 8` | `paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16`; **`gap` removed** |
| block rhythm | uniform `gap: 8` between 5 unrelated tiers + ad-hoc `byRow marginTop: 2` | chips `marginBottom: 12` → title `marginBottom: 6` → logline `marginBottom: 14` → metaRow `marginBottom: 14` → hairline `#e5e7eb` at `marginHorizontal: -16` → byRow `marginTop: 14` |
| `styles.title` | `{...typography.h1, flex: 1}` (22/27, weight 800) | `typography.display2` (26/30 Fraunces), `numberOfLines={2}`, full plate width |
| `ChevronRight` + `titleRow` | 20pt `#9ca3af` (1.83:1), vertically centred on a 2-line title, stealing 28pt of measure so title and description wrap at different widths | **deleted** — the whole plate is already a Pressable with an accessibility label |
| `logline` | `typography.small` `#6b7280` (3.92:1 on the old composite) | `typography.body` `#4b5563` — on opaque white that is 7.56:1 |
| role chips | `tone="accent"` `#ede9fe` fill at `fontSize: 11` | `tone="accent"` with ground `#f5f3ff`, ink `#6d28d9`, `typography.micro` — they stop out-shouting a headline they precede |
| `<Fade height={340} to={0.5}/>` | 8 bands over 340pt; final step Δα **0.117** across one hard pixel edge (~8–12 L\*, threshold is ~1), bleaching the bottom 40% of every photo | **deleted from both `SwipeCard` and `SwipeCardBehind`** |

The plate's own docblock at `Fade.tsx:3–10` claims "the steps are under a pixel of perceived difference." That is false by roughly an order of magnitude and the banding is visible across the concrete in screenshot 01. Replace the component with a single `expo-linear-gradient` instance used in **one** place: a top scrim so the global `StatusBar style="dark"` stays legible over an arbitrary photo — `<LinearGradient colors={["rgba(255,255,255,0.62)","rgba(255,255,255,0)"]} style={{height: insets.top + 48}}/>`. Also delete the unused `fadeStyles` export at `Fade.tsx:47`.

Then move the action row **into** the plate as its foot: `borderTopWidth: StyleSheet.hairlineWidth`, `paddingVertical: 14`, `justifyContent: "center"`, Undo absolutely positioned `left: 16` so the Pass/Like pair centres on the screen spine. Today `justifyContent: "center"` on 48 + 64 + 64 with `gap: 18` centres the *bounding box*: the pair's centre lands at x = 253 on a 440pt screen, 33pt right of true centre.

### 4 — FATAL · Six hues on one screen; write the color rule and enforce it
**Screens:** all. **Files:** `mobile/src/lib/theme.ts:40–53`; `connect.tsx`, `_layout.tsx`, `stories.tsx`, `post/[id].tsx`.

Live on Discover simultaneously: violet `#7c3aed` (chips), blue `#1d4ed8` (+ button), green `#22c55e` (Like, plus a green halo), red `#dc2626` (Pass), amber `#f59e0b` (Undo), blue-100 `#dbeafe` (tab pill) with a violet badge on the same bar. The codebase has 40 references to `colors.accent` and 32 to `colors.brandText` with no rule distinguishing them — the + on Discover is blue, the pencil FAB on Stories is violet, the wizard progress bar is violet but its Next button is blue. The choice tracks whichever file the component was written in.

| Element | Before | After |
|---|---|---|
| Discover Like | `#22c55e` + green glow | `#7c3aed` + `shadows.float` |
| Discover Pass | `#dc2626` X | `#111827` X |
| Discover Undo | `#f59e0b` | `#111827` |
| Project-detail CTA (`post/[id].tsx:380–390`) | `height: 56, borderRadius: 28, backgroundColor: colors.like, ...shadows.glow` | `height: 52, borderRadius: radii.sm (12), backgroundColor: colors.brand`, no shadow; label `typography.headline` white; **drop the leading `Check` glyph** — a check means "done," not "like" |
| Tab pill ground | `brandSoft #dbeafe` | see fix 5 |
| Unread badge | `colors.accent` | `colors.brand` |
| `applyBar.paddingHorizontal` | `16` while `body` is `20` and `topBar` is `16` — three left edges on one screen, a visible 4pt step under the content column | all three → `GUTTER` 16 |

Delete `like`, `likeSoft`, `passText`, `warning`, `success`, `successSoft`, `brandOutline`, `brandTabBg` from `theme.ts` so the recolour is enforced by the compiler rather than by discipline.

### 5 — FATAL · One gutter, one bar height, one radius set
**Screens:** all. **Files:** `SwipeCard.tsx:398–404, 425–427`; `connect.tsx:340–351`; `_layout.tsx:153–180`; `stories.tsx:224, 299`; `post/[id].tsx:340–380`; `profile.tsx:647`.

Measured down Discover: progress segments inset **14**, search/+ buttons **12**, plate **10**, error banner **16**, tab bar **16**. Five stacked elements, four left edges, all visible at once — in screenshot 01 the plate's left edge sits ~6pt outboard of the tab bar's directly beneath it. Worse, the plate's outer margin (10) is smaller than its own inner padding (16), so the content is further from the plate edge than the plate is from the screen: the card looks like it is sliding off the display.

Set `GUTTER = 16` in `theme.ts` and import it: `segments.left/right 14→16`, `topControls.left/right 12→16`, `tabBarOuter.left/right` already 16, `errorSlot` already 16, `stories.fab.right 20→16`, `post/[id].body.paddingHorizontal 20→16`, `post/[id].topBar 16`. The plate itself is the one deliberate exception at 0 (fix 3), which is the signature, not an accident. Then delete all five `TAB_BAR_CLEARANCE` literals in favour of `useBarTop()` per §2.8, and snap the 18 literal `borderRadius` values (9, 4, 2, 11, 3, 19, 5, 28, 23, 20, 18, 17, 15, 14, …) to the four-value scale.

### 6 — FATAL · Discover: the swipe commits in an animation callback, and the buttons can hard-lock
**Screen:** Discover. **File:** `mobile/src/components/SwipeCard.tsx:242–295`.

Three defects on the same lines. (a) `triggerSwipe` — which fires the haptic *and* calls `onSwipe` — runs inside the `withTiming` completion callback, so the buzz lands 220–260ms after the finger left, on a card that is already off-screen. (b) The callback is guarded by `if (done)`; touch the screen during those 220ms and the timing is interrupted, `done` is false, `onSwipe` never fires, and the swipe is silently lost with no record written. (c) The button path sets `pendingButtonSwipe` and clears it only in that same guarded callback — tap Like, then touch the card before 260ms elapses, and `pendingButtonSwipe` stays `"right"` forever, the effect dependency never changes again, and **Like and Pass are dead for the rest of the session**. There is no `.onFinalize`, so an incoming call also parks `tx` off-centre permanently.

| | Before | After |
|---|---|---|
| commit point | `runOnJS(triggerSwipe)(dir)` inside `withTiming(…, cb)` | `runOnJS(triggerSwipe)(dir)` as the **first line** of the `wentRight` / `wentLeft` branch in `.onEnd`, before the exit animation starts |
| exit easing | `withTiming(SCREEN_W * 1.5, { duration: 220 })` — RN default `Easing.inOut(quad)`, so the card *decelerates* as it leaves | `Easing.bezier(0.4, 0, 1, 1)` |
| exit duration | fixed 220ms regardless of a 2400px/s flick or a 50px/s nudge | `const vx = Math.max(Math.abs(e.velocityX), 900); const remaining = SCREEN_W * 1.25 - Math.abs(dx); const dur = Math.max(130, Math.min(300, remaining / vx * 1000));` |
| vertical arc | `ty` frozen; `e.velocityY` never read | `ty.value = withTiming(ty.value + e.velocityY * 0.10, { duration: dur, easing: exit })` |
| snap-back | `{ damping: 18, stiffness: 220 }` — ~6% overshoot, wobbles twice | `motion.springs.snap` |
| cancel recovery | none | `.onFinalize(() => { tx.value = withSpring(0, snap); ty.value = withSpring(0, snap); })` |
| button lock | cleared only in the guarded callback | clear `pendingButtonSwipe` in the parent immediately after the effect reads it |
| double haptic | `connect.tsx:307` and `:319` fire `impactAsync`, then `triggerSwipe` fires it again ~260ms later — one tap, two identical thumps | delete both `onPress` haptics; `triggerSwipe` is the single source |
| threshold cue | none | in `.onUpdate`, latch a one-shot `runOnJS(Haptics.selectionAsync)()` when `|translationX|` first crosses `SWIPE_THRESHOLD` |

### 7 — FATAL · Nothing in the app responds to touch
**Screens:** all. **Files:** `ui/GlassButton.tsx:81`; `ui/Button.tsx`; `SwipeCard.tsx:110`; `stories.tsx:246`; `chat/[matchId].tsx`.

Not one press state is animated — `Pressable`'s style callback applies on the touch frame and reverts on lift, so `GlassButton`'s `scale: 0.93` is a 7% jolt, not a press. `StoryCard` uses `scale: 0.995`, which on a 408pt card is 1.8pt of movement, below the perceptual floor, paired with a 5% opacity drop that is equally invisible. The Discover plate — the tap target that opens the project — changes opacity by 0.08 on a translucent surface, which composites to nothing. The chat Send button passes a **static** style array, so sending a message produces zero visual and zero haptic acknowledgement.

Build one `usePressScale()` on Reanimated and use it everywhere: `onPressIn → withTiming(DOWN, { duration: motion.durations.instant, easing: motion.easings.standard })`; `onPressOut → withSpring(1, motion.springs.press)`. DOWN by element: circular 0.90, full-width 0.97, card/plate 0.975 with shadow interpolated `shadowOpacity 0.08 → 0.03` and `shadowRadius 20 → 6`. Haptic `Light` on `onPressIn` for every primary action. Also: `connect.tsx:228` passes `disabled={swiping}` to the card, but that gates only the Pan gesture — the paging zones and the plate Pressable stay live, so you can route to a project for a card that has already been swiped. Gate those too.

### 8 — MAJOR · Tab bar: unlabelled lucide glyphs under a sliding Material pill
**Screens:** all (01, 03, 06). **File:** `mobile/app/(tabs)/_layout.tsx:46–51, 69–89, 165–180`.

Four 23px glyphs — `Sparkles`, `BookOpen`, `MessageCircle`, `UserRound` — with no text. Line 93 computes `label` and uses it only for `accessibilityLabel`. A sparkle does not mean "Discover" and an open book does not mean "Stories," which is a product-specific concept this app invented and now refuses to name anywhere in its navigation. The file's docblock justifies this on height grounds, but the bar is 61pt tall for a 23pt icon — there is 38pt of padding to spend. Meanwhile the active indicator is a `(barWidth − 12)/4` = **99×47pt** blue-100 lozenge drawn around a 23pt icon (4.3× its width) that `withSpring`s horizontally on every tab change: that is Material Design 3's `NavigationBar` active indicator verbatim, and `docs/DESIGN.md` bans it by name ("Don't add another tab bar shape (pill, segment)"). Its radius is `radii.xl` (20) inside a 24pt container with 6pt padding, where concentric requires 18 — so the inner curve runs non-parallel to the outer one.

| | Before | After |
|---|---|---|
| labels | none | `<Text style={styles.tabLabel} numberOfLines={1}>{label}</Text>`, `typography.micro`, `marginTop: 3`; `Inter_600SemiBold` + `colors.brand` when focused |
| icon | `size: 23` | `size: 21` |
| `tab.paddingVertical` | `12` | `8` |
| `TAB_BAR_PAD` | `6` | `8` |
| bar height | 61 | **67**, exported as `TAB_BAR_H` |
| pill | `brandSoft #dbeafe`, 99×47, `borderRadius: radii.xl`, `withSpring({damping:20, stiffness:220})` ≈ 380ms | **deleted** — selection is icon + label in `colors.brand`, unselected `#4b5563`; cross-fade with `withTiming(150, motion.easings.standard)` |
| icon colour timing | plain React render, so the destination icon snaps on frame 0 while the pill is a third of the way across — highlight and highlighted item are in different places for ~300ms | moot once the pill is gone |
| badge | `fontSize: 10, fontWeight: "800"`, `colors.accent` | `typography.micro` + `fontVariant: ["tabular-nums"]`, `colors.brand` |
| focused tap | `if (!focused …)` — tapping the current tab does nothing at all | `if (focused) { Haptics.impactAsync(Light); navigation.emit({ type: "tabPress", target: route.key }); }` and scroll each screen to top on that event |
| first paint | `tx` starts at 0, so a deep link into Profile animates the indicator in from the far left | moot |

### 9 — MAJOR · Discover: progress segments run behind the floating controls
**Screen:** Discover (01). **Files:** `SwipeCard.tsx:76, 398–411`; `connect.tsx:243`.

Segments sit at `top: topInset + 10` = 72pt, full width 14→426. The two 42pt control discs sit at `top: topInset + 8` = 70pt, spanning 70–112pt and the right ~100pt. The track therefore passes **behind** both circles — visible in screenshot 01, where the grey second segment disappears under the search disc and re-emerges past the +. On any project with three or more images the rightmost segment, the one that matters, is permanently occluded.

Separate the bands: `segments.top → topInset + 8`, `left/right → 16`, `height 3 → 2.5`, `borderRadius 2 → 1.25`, `gap 4 → 3`; `topControls.top → topInset + 26`. Also give the segments a track so they survive an arbitrary photo — at `rgba(255,255,255,0.45)` with no shadow they vanish against the blown-out brick at the top of screenshot 01, which is the one thing Instagram's version gets right and this copy does not: `backgroundColor: "rgba(255,255,255,0.50)"`, `segmentOn: "#ffffff"`, both with `shadowColor: "#000", shadowOpacity: 0.30, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }`.

### 10 — MAJOR · Discover: the behind-card promotion is a no-op, and rotation exposes grey wedges
**Screen:** Discover. **Files:** `SwipeCard.tsx:189–211, 297–308, 377–383`; `connect.tsx:218–237`.

`SwipeCardBehind` springs `scale` 0.95→0.97 in a `useEffect` keyed on `post.id`, but the component is never remounted (no `key` at `connect.tsx:219`), so from card two onward `scale.value` is already 0.97 and `withSpring(0.97)` animates 0.97→0.97 — **zero motion, permanently**. Meanwhile the front card *is* keyed by id, so on swipe it unmounts and a fresh `SwipeCard` fades up from `opacity: 0` over the `#f3f4f6` ground. The back card never becomes the front card; it is discarded and a different view crossfades on top of it. The deck has no object permanence. Additionally `Poster dim` applies `opacity: 0.7` on top of the container's 0.8, landing the back photo at an effective 0.56 — grey sludge.

Drive the back card from the front card's drag: pass `tx` down, `const p = Math.min(1, Math.abs(tx.value) / SWIPE_THRESHOLD)`, `scale: 0.94 + p * 0.06`, `opacity: 0.82 + p * 0.18`; on commit finish with `withSpring(1, motion.springs.promote)`. Delete the `dim` prop. Delete the `GlassPanel` call at line 207 — it mounts a second `BlurView` that is never seen and is the most expensive thing on the screen.

Separately: `ROTATION_MAX = 10` is applied about the centre of a view styled `...StyleSheet.absoluteFillObject`. At 10° on a 440×956 frame the corner wedges exposed are ≈74pt, and the card's own `backgroundColor: colors.surfaceStrong` plus a 0.97-scale back card do not cover them — so every swipe shows four flat light-grey triangles eating the corners of a full-bleed photo. Fix: `ROTATION_MAX = 5`, and pivot below the frame so the card hinges like held paper rather than spinning like a dial — `[{ translateX }, { translateY }, { translateY: PIVOT }, { rotate }, { translateY: -PIVOT }]` with `const PIVOT = SCREEN_H * 1.15`. Give `Poster` `margin: -88` inside the `overflow: "hidden"` parent so no angle can expose the ground. Finally, strip `opacity` from the entrance spring (`SwipeCard.tsx:300`) — a spring overshoots and opacity clamps, producing a hitch; keep only `scale: 0.96 → 1` with `motion.springs.promote` and delete the 14px `translateY` drift.

### 11 — MAJOR · Discover: swipes block on two network round-trips
**Screen:** Discover. **File:** `connect.tsx:112–168`.

`setIndex((i) => i + 1)` runs only after `await recordSwipe(...)` and, on a right swipe, after `await checkAndCreateMatch(...)` as well. Between the card leaving and the server answering, the user stares at a dimmed undersized back card with no spinner. `rewind` is worse: `Haptics.impactAsync(Medium)` at line 163 fires *after* `await undoSwipe(...)`, so the buzz for undo arrives hundreds of milliseconds after the tap, and the restored card teleports in through the standard entrance rather than flying back from the edge it left by.

Advance optimistically: `setIndex` and `setLastSwipe` synchronously at the top of `handleSwipe`, fire both awaits in the background, and on failure roll the index back with the undo animation plus `Haptics.notificationAsync(Error)` and the `ErrorBanner`. In `rewind`, move the haptic to the first line before any await, then set `tx.value` to `±SCREEN_W * 1.25` with no animation and `withSpring(0, motion.springs.promote)` so the card visibly returns from the side it was thrown.

### 12 — MAJOR · Discover: delete the rotated LIKE / PASS stamps
**Screen:** Discover. **File:** `SwipeCard.tsx:357–368, 413–423`.

`fontWeight: "900"`, `fontSize: 26`, `letterSpacing: 3`, 3pt border, rotated −12°/+12° on a 0.9-white plate. This is a pixel-level reproduction of Tinder's 2013 stamp, down to the angle and the stroke weight, and 26/900 are both off-scale. Opacity maps linearly over the threshold, so it fades in flat and mechanically. Replace with two layers driven by `p = smoothstep(|tx| / SWIPE_THRESHOLD)`: a full-card tint (`rgba(124,58,237,0.18)` like / `rgba(17,24,39,0.22)` pass) at `opacity: p`, and one centred glyph — Heart or X, 88pt, white, `strokeWidth 2.25`, inside a 120pt `rgba(255,255,255,0.18)` circle with a 2pt `rgba(255,255,255,0.90)` ring — at `opacity: p, scale: 0.82 + p * 0.18`. Use `p * p * (3 - 2 * p)` so it stays quiet through the first third of the drag then commits.

### 13 — MAJOR · Profile: four solutions to one problem on one screen
**Screen:** Profile (06). **File:** `mobile/app/(tabs)/profile.tsx:640–720`.

Four consecutive cards, four header patterns: CREDITS is an uppercase eyebrow with a right-aligned violet sparkle glyph; WORK is an eyebrow with a blue text link "Add"; PORTFOLIO is an eyebrow with a grey `+ Add` pill (`addPortfolioBtn`, `fontSize: 12`); the form card has no eyebrow at all and uses sentence-case "Name" at 12pt. Three trailing-action treatments in three different colours within 400pt of scroll. The `portfolioEmpty` dropzone is a **2pt dashed border** drag-and-drop target — a desktop affordance for an interaction that cannot happen on iPhone.

One pattern: `typography.eyebrow` left, and a single trailing action — `typography.caption` at `Inter_600SemiBold`, `colors.brandText`, no icon, no container, `hitSlop={12}` — right. Apply to CREDITS (drop the sparkle), WORK, PORTFOLIO, and give the form card a "DETAILS" eyebrow so all four match. Replace `portfolioEmpty` with a 3-column grid of 1:1 tiles at `borderRadius: radii.sm`, the first a filled `#f9fafb` square with a 22pt `#6b7280` plus glyph. `scroll: { gap: 14, paddingBottom: 150 }` → `{ gap: 16, paddingBottom: barTop + 24 }` — the 150 leaves ~49pt of dead space under the last card while the tab bar simultaneously covers the role chips in the screenshot. Strip the white card wrapper off CREDITS/WORK/PORTFOLIO (`section` at `profile.tsx:705`) and separate them with `marginTop: 32` + a hairline rule above each eyebrow: screenshot 06 is six identical rounded rectangles with no weight difference between them, which is exactly the "card-in-a-card framing" `DESIGN.md:51` forbids.

### 14 — MAJOR · Post-a-story: unreadable step labels, 23pt tap targets, half an empty screen
**Screen:** Post a story (05). **File:** `mobile/src/components/StoryForm.tsx:216–222, 239–246, 528–534`.

`barLabel` is `typography.tiny` (11px) in `colors.textFaint` **#d1d5db on #ffffff = 1.47:1**. "Who with", "Photos" and "Finish" are invisible in the screenshot, so the wizard's own roadmap cannot be read. Each `progressItem` is 3 + 6 + ~14 = **23pt tall**, roughly half the 44pt floor, and it is the only route back to a previous step. Below, the last field ends at ~410pt and the footer begins at ~912pt: **~500pt, 52% of the screen, is empty white**, because `scroll` has `paddingBottom: 24` and no `flexGrow`.

| | Before | After |
|---|---|---|
| `barLabel.color` | `colors.textFaint` | `colors.textSecondary` `#4b5563` (7.56:1 on white) |
| `progressItem` | no vertical padding | `paddingVertical: 11` → 45pt target |
| `bar` | `height: 3, gap: 6`, four separate segments | one continuous `height: 4, borderRadius: 2` track in `#e5e7eb` with a `colors.brand` fill animated `withTiming(\`${(step+1)/STEPS.length*100}%\`, { duration: 300, easing: motion.easings.standard })` |
| step colour | `barOn: colors.accent` violet while the Next button is `colors.brand` blue — two "active" colours on one screen | both `colors.brand` |
| `TextArea numberOfLines` | `7` (~200pt) | `12` (~330pt) |
| `scroll` | `{ padding: 16, gap: 14, paddingBottom: 24 }` | `{ padding: 16, gap: 20, paddingBottom: 32 }` |
| `stepTitle` | `{...typography.h1, marginTop: 6}` | `typography.display1`, `marginTop: 16` |
| `stepHint` | `marginTop: -6` | `0` — negative margins clawing back a container gap are the fingerprint of layout tuned by nudging |
| footer | `paddingBottom: 8`, bare hairline | `paddingBottom: 16`, `paddingTop: 14`, wrapped in `<BlurView intensity={40} tint="light">` over `rgba(255,255,255,0.86)` with `shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12` so content does not scroll into nothing |
| failed validation | `validateStep` returns silently — no haptic, no indication | `Haptics.notificationAsync(Warning)` + shake the offending field: `withSequence(withTiming(-6,{duration:50}), withTiming(6,{duration:50}), withTiming(-4,{duration:50}), withSpring(0, motion.springs.press))` |
| step transition | `setStep(s+1)` hard-cuts | `entering={SlideInRight.duration(260).easing(motion.easings.enter)}`, `exiting={SlideOutLeft.duration(200).easing(motion.easings.exit)}`, reversed for Back |
| `coverTagText` | `fontSize: 9` | `typography.micro` |

### 15 — MAJOR · Stories: the masthead oversells a two-item list, and the FAB lands on a face
**Screen:** Stories (03). **File:** `mobile/app/(tabs)/stories.tsx:82–90, 134–146, 224–229, 246`.

A three-deck newspaper masthead — "THE RECORD" (eyebrow, `#9ca3af` on `#f3f4f6` = **2.31:1**) / "Stories" (30/800) / a 13px standfirst — sits on a list containing two cards. The kicker, the title and the deck say the same thing three times, and `heading` has `marginTop: 2` while `subhead` has `marginTop: -8` fighting the container's `gap: 14`.

Delete the "The record" eyebrow and the string. `heading` → `typography.display1`. `subhead` → a real deck: `typography.headline` at `Inter_400Regular`, `#4b5563` (32 → 17 is a 1.88× step, with the family change carrying the rest). Delete both negative/positive margin hacks; remove `gap: 14` from `scroll` and space the header explicitly: `heading { marginBottom: 4 }`, `subhead { marginBottom: 28 }`.

The FAB is a 58pt solid-violet circle at `right: 20` (against a 16pt grid) pinned at `bottom: 112` — it lands squarely on the second story's photograph, over a pedestrian, and is the only object in the feed using the accent as a *fill*, so the eye goes to it before any story. A circular FAB is a Material idiom in an app whose bottom-right corner is already occupied by a floating bar. Delete it and move compose into the header, which already has `flexDirection: "row"` and a `flex: 1` spacer waiting at line 83: a 36pt circular `+` in `#f9fafb` with a `#111827` glyph at `right: GUTTER`, baseline-aligned to "Stories". That gives Stories, Profile and Matches one header grammar. Also convert the feed from `ScrollView` to `FlatList` with `windowSize={5}` — it currently mounts every 220pt photo card at once.

Card typography: `cardTitle` `typography.h1` (22/800) sits above `byName` at 13/700 — the author line is seven-eighths as bold as the headline. `cardTitle` → `typography.title` (20/26 Inter_600SemiBold); `byName` → `typography.bodyStrong`; wrap the collaborator chips' **names** out of pills entirely (`Maya Chen` in `#111827` 600 + `Photographer` in `#4b5563` 400, separated by a `·`) — a person's name is not a tag, and the same capsule currently carries six unrelated meanings across the app.

### 16 — MINOR · Status bar over full-bleed photography
**Screens:** Discover (01), Story detail (04). **File:** `mobile/app/_layout.tsx:56`.

`<StatusBar style="dark" />` is set once globally and never overridden, while two screens are edge-to-edge photographs. In 04 the clock and the Wi-Fi/battery glyphs are near-black over a dark studio interior. Keep `style="dark"` — it is correct for five of seven screens and the light-palette constraint — and give the two photo screens the top white gradient specified in fix 3 (`rgba(255,255,255,0.62)` → transparent over `insets.top + 48`), which guarantees a light ground under the glyphs on any image. The back button at `story/[id].tsx:329` is a flat light-grey circle with `shadows.soft` sitting on a dark photo; give it the §2.5 glass recipe plus `shadows.float`.

### 17 — MINOR · Four date formats, proportional figures
**Screens:** 03, 05, 06, project detail. **Files:** `mobile/src/lib/stories.ts`, `post/[id].tsx:261`.

"Jul 2026" / "Aug 26" / "8/25" / "Posted 8/4/2026" across four screenshots of one product; three of them are ambiguous. One formatter in `mobile/src/lib/format.ts` used everywhere: <7 days → `"3d"`; same calendar year → `"12 Aug"`; otherwise → `"Aug 2025"`. Never slashes. With `tabular-nums` on `caption`/`micro` (§2.4) the right-aligned metadata columns in the Stories feed and the profile credits list stop jittering.

### 18 — MINOR · `docs/DESIGN.md` describes a different product
**File:** `docs/DESIGN.md`.

It specifies Fraunces display, coral `#E55A4C` as the single accent, warm `#FAFAF7` ground, `--line #EAE7E0`, radii 8/12/14/18, and a two-layer soft shadow, with tokens living in `app/globals.css` — a web file, last updated May 2026. The app ships `#f3f4f6`, violet + blue, `#e5e7eb`, radii 8/12/16/20/24/28, system sans, a pill tab bar with a pill indicator, segmented progress bars in both wizards, and card-in-a-card framing on every screen in the set — each of which the doc's own "Don't" list forbids by name. Not one token matches. **This is the root cause of every other finding here:** each screen was decided locally because nothing decided globally.

Rewrite it in the same commit as fixes 1–5, as the *mobile* spec, from §2 of this document verbatim, and add the motion section — including the rule "exactly one bouncy spring in the app, and it belongs to the match." Delete every reference to Fraunces-as-unimplemented, coral, `#FAFAF7` and `globals.css`. Note the one rule I am deliberately overturning: the doc bans pill tab bars outright, but the floating bar is the best idea in the current design and should stay — what goes is the sliding *indicator* inside it. Change the rule rather than pretend it is being followed.

---

## 5. What the critics got wrong

**1. "The Next button is clipped under the home indicator." Marked fatal. It is false.**
`StoryForm.tsx:631–638` has `paddingBottom: 8` and no `useSafeAreaInsets()`, which is what the critics read — but `app/story/new.tsx:21` wraps the form in `<SafeAreaView edges={["bottom"]}>`, and `app/post/new.tsx:21` does the same for `ProjectForm`. The parent supplies the 34pt inset. Screenshot 05 confirms it: the button's bottom edge sits ~44pt above the screen bottom with its lower corners fully rounded and intact. Two critics asserted the screenshot "shows" a clipped button; it shows the opposite. The real defect is that 8pt is the only *designed* padding and there is no material behind the bar, which is a minor fix (item 14), not a fatal one. Flagging a bug you can see is disproved in the evidence you cited is the kind of error that discredits the rest of a review.

**2. "Two different tab bars ship in the app." It is one stale screenshot.**
`05-matches.png` shows labelled Explore / Discover / Matches / Profile with a compass glyph; `_layout.tsx` on this branch has exactly one bar, icon-only, with Sparkles / BookOpen / MessageCircle / UserRound. The matches asset predates the branch — it is an out-of-date file in `docs/design/projects-ios/`, not a navigation shipped twice. The *regression* the stale shot reveals is real and is item 8; the "work assembled in parallel with no hand over it" conclusion drawn from it is not supported. Regenerate the asset.

**3. The tab bar height was given as 58, 61 and 95 by three different critics. The answer is 61 + inset.**
`Glass` contributes `borderWidth: 1` on each edge (2), `tabBar` `padding: TAB_BAR_PAD` 6 ×2 (12), `tab` `paddingVertical: 12` ×2 (24), icon 23 → **61pt of glass**, sitting on `paddingBottom: Math.max(insets.bottom, 12)` = 34, so the bar's top edge is at **95pt** on this device and 73pt on a 0-inset SE. The critic who wrote 58 dropped the icon's padding; the one who wrote "61 is the bar height, so clearance is 61" dropped the inset. Everything downstream of those numbers was wrong by 34pt.

**4. "Scrim the photo with black at 0.55." Rejected — it violates the owner's constraint and is unnecessary.**
Four critics independently proposed inverting the bottom wash to `rgba(0,0,0,0.55)` or `rgba(11,18,32,0.34)` on the grounds that "glass only reads as glass when it is bright against something darker." The reasoning is correct for a dark-chrome app and wrong for this one: the owner's constraint is light only, and a 55%-black band across the bottom third of every photo *is* dark chrome regardless of which layer it lives in. The correct answer is the one none of them reached — make the content surface **opaque white** (fix 3), at which point the scrim is not needed at all, the photograph keeps full density and chroma down to the plate edge, body copy goes from 3.92:1 on a shifting composite to 7.56:1 on a fixed ground, and the contrast of the surface stops depending on which photo happens to be underneath. Keep a *white* gradient only at the top, where it serves the dark status bar.

**5. "`panelClip.borderRadius` must be `28 − 16 = 12` for concentricity." Wrong rule applied.**
The concentric rule governs a shape nested *inside* another shape's padding. `panelPress.paddingHorizontal` is a screen margin, not a parent container's inset — the plate is not nested inside the card's 28pt corner, it is a sibling floating above it. The critic who computed `24 − 6 = 18` for the tab-bar pill applied the rule correctly (6 is genuine inner padding); the one who computed 12 for the plate did not. Under fix 3 the plate's bottom corners are squared anyway and the question dissolves.

**6. "`SwipeCardBehind` is 100% occluded and contributes nothing."**
It is fully occluded only at rest. The moment the top card translates or rotates it is the thing the user sees, which is why its broken promotion animation matters. The same critic's conclusion — delete it — would remove the deck's only depth cue; the right call is the other critic's, to drive it from the drag (item 10). Both were half right; the "dead code" framing is wrong.

**7. "Map every token to a UIFont text style and take body to 17pt." Partly rejected.**
Dynamic Type support is a genuine gap and worth doing (`PixelRatio.getFontScale()` clamped to 1.0–1.35 on the display tiers, uncapped below). But promoting `body` from 15 to 17 because "iOS body is 17" is a category error on a content-dense product with a 408pt measure — 17/22 Inter in a plate caption would force a second wrap on the Discover title block and reduce, not improve, the hierarchy. 15/23 Inter with a real display face above it is the stronger answer. Also: the instruction to "remove `allowFontScaling={false}` anywhere it appears" is a non-issue — `grep` returns zero occurrences in the repo.

**8. "`typography.tiny` is 2.54:1." It is 2.31:1.**
`#9ca3af` on `#f3f4f6` measures 2.31 and `#6b7280` on `#f3f4f6` measures **4.39**, not the 4.43/4.8/4.83 variously quoted — which matters, because 4.39 means the app's "safe" muted grey *also* fails AA on the ground colour and several fixes that routed text to `#6b7280` would not have fixed anything. That is why §2.1 moves secondary text to `#4b5563` (6.87:1) and confines `#6b7280` to white surfaces only.

**9. "Delete the Chip component's role in the glass panel and set roles as a tracked caps line." Over-corrected.**
Removing the chips entirely loses the one scannable taxonomy on a card the user is deciding about in two seconds. The defect is that opaque `#ede9fe` pills at `fontSize: 11` are the loudest, most saturated objects in screenshot 02 while carrying the least important information — a hierarchy inversion, not a component error. Demote them (ground `#f5f3ff`, ink `#6d28d9`, `typography.micro`) rather than delete them. The same critic's point about a *person's name* in a capsule on the Stories feed is correct and is in item 15.

**10. "Recolour the Like to brand blue #1e3a8a."**
Two critics said blue, two said violet. Violet wins: `DESIGN.md` already assigns the single accent to affirmative moments, blue is doing structural work on the + button, the wordmark, the Next CTA and the nav, and white-on-violet is 5.70:1 against white-on-blue's 10.36:1 — the brand colour is too heavy to be the thing a user taps forty times a session. Blue is structure, violet is yes. One line, statable, enforceable.

**11. "Replace lucide with SF Symbols via `expo-symbols`." Right diagnosis, deferred.**
Lucide's uniform-stroke geometry does read foreign next to SF, and the stroke weights in use are genuinely uncontrolled (1.1, 1.2, 1.4, 2, 2.4, 2.5, 2.75) across 13 sizes. But swapping icon libraries mid-branch is a cross-cutting change with no visual payoff until items 1–8 land. Do the cheap half now — create `mobile/src/components/ui/Icon.tsx` that hard-codes `strokeWidth={1.75}` and accepts only `size` 14/18/24, and replace every direct lucide import — then evaluate SF Symbols separately. Flagged so it is not silently dropped.

**12. Not raised by any critic, and it is a hard lock in the primary flow.**
`pendingButtonSwipe` is cleared only inside a `withTiming` completion callback guarded by `if (done)` (`SwipeCard.tsx:259–264`). Touch the card within 260ms of tapping Like and the Like and Pass buttons are dead for the rest of the session with no error and no recovery path. Seven critics reviewed this screen and four of them described the surrounding lines. It is item 6.