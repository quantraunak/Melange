/**
 * Design tokens. The single source of truth for every visual decision.
 *
 * Implemented from docs/DESIGN_SPEC.md §2 verbatim. Read that document before
 * changing anything here: every value below was measured against screenshots,
 * not chosen. The rules it encodes, in one paragraph:
 *
 *   Paper, ink, one accent. Off-white paper, white surfaces, near-black ink.
 *   Indigo is for links and the one primary action per screen; "yes" states
 *   (liked, selected) are ink. Flat colour only, shadows almost never, radii
 *   6-10 for controls and 0-4 for photos. Light only. Chrome floats inset at
 *   GUTTER and is the only thing allowed to be glass. The rules live in
 *   .claude/skills/melange-design/SKILL.md.
 *
 * An ESLint rule bans `fontSize` outside this file. If you need a size that
 * is not here, the answer is almost always that you need a different token.
 */

import type { TextStyle } from "react-native";
import { Easing } from "react-native-reanimated";

export const colors = {
  // Paper and surfaces. Flat: color comes from members' photos, not decoration.
  bg: "#fafaf7", // paper
  surface: "#ffffff",
  surfaceSunken: "#f3f3ef", // input wells and empty photo slots only
  line: "rgba(20,20,20,0.10)", // every hairline
  lineStrong: "#e4e4de", // input wells, disabled outlines
  scrim: "rgba(20,20,20,0.35)",

  // Ink. textTertiary is legal on #ffffff only.
  text: "#141414",
  textSecondary: "#4a4a46",
  textTertiary: "#6b6b66",
  /** Non-text strokes, dividers, placeholder glyphs. Never a text colour. */
  iconFaint: "#a3a39c",
  white: "#ffffff",

  // Indigo is the one accent: links and the single primary action per screen.
  brand: "#3730a3",
  brandText: "#3730a3", // text links only
  onBrand: "#ffffff",
  onBrandMuted: "#c7d2fe", // secondary text on a brand-filled ground

  // "Yes" states (liked, matched, selected) are set in ink, not a second hue.
  accent: "#141414",
  accentSoft: "#eeeee9",
  accentInk: "#141414",
  onAccent: "#ffffff",
  onAccentMuted: "rgba(255,255,255,0.72)", // metadata inside an ink bubble

  // Red is destructive confirmation. It is not a UI colour.
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  dangerText: "#b91c1c",
  dangerLine: "#fecaca", // the hairline on a destructive surface

  // Chat
  bubbleMe: "#141414",
  bubbleOther: "#efefea",
};

/**
 * Controls sit at 6-10; photos at 0-4. sm chips/inputs · md buttons/inner
 * blocks · lg sheets/tappable cards/the bar · photo images · pill circles only.
 */
export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  photo: 2,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/** One screen edge, everywhere. The Discover plate is the single deliberate exception at 0. */
export const GUTTER = 16;

export const fonts = {
  display: "Fraunces_600SemiBold",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/**
 * Nine tokens. Three weights total: Fraunces 600 for display, Inter 400/500/600
 * for text, Inter 700 for `eyebrow` alone. Every token carries lineHeight, so
 * nothing falls back to the platform's metric leading.
 */
export const typography: Record<
  | "display1"
  | "display2"
  | "title"
  | "headline"
  | "body"
  | "bodyStrong"
  | "caption"
  | "micro"
  | "eyebrow",
  TextStyle
> = {
  display1: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.9,
    color: colors.text,
  },
  display2: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text,
  },
  headline: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0,
    color: colors.text,
  },
  bodyStrong: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  micro: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.65,
    textTransform: "uppercase",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
};

/**
 * Shadows almost never. Content is flat on paper and separated by space and
 * hairlines, so `card` and `plate` are zero (kept as names so a surface can
 * say what it is). `float` is a faint lift for glass controls sitting on a
 * photograph, where an edge alone disappears.
 */
const NONE = {
  shadowColor: "#000000",
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};
export const shadows = {
  card: NONE,
  plate: NONE,
  float: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

/**
 * Glass is for floating controls over photography and for the tab bar. That is
 * the whole list. Content surfaces are opaque white — stacking translucent
 * white until text barely passes contrast is what this replaces.
 */
export const glass = {
  tint: "systemThinMaterialLight" as const,
  intensity: 60,
  tintLayer: "rgba(255,255,255,0.42)",
  /** Dark hairline: survives a bright photo and a dark one. A white rim only survives one. */
  rim: "rgba(17,24,39,0.12)",
  specular: "rgba(255,255,255,0.80)",
};

/** Exactly one bouncy spring exists in this app and it belongs to the match. */
export const motion = {
  springs: {
    press: { damping: 26, stiffness: 420, mass: 0.7 },
    snap: { damping: 22, stiffness: 260, mass: 0.9 },
    promote: { damping: 24, stiffness: 300, mass: 1.0 },
    celebrate: { damping: 15, stiffness: 190, mass: 0.9 },
  },
  durations: { instant: 90, quick: 180, base: 240, slow: 320 },
  easings: {
    enter: Easing.bezier(0.16, 1, 0.3, 1),
    exit: Easing.bezier(0.4, 0, 1, 1),
    standard: Easing.bezier(0.2, 0, 0, 1),
  },
  press: { circle: 0.9, card: 0.975, wide: 0.97 },
};

/**
 * One haptic per meaning. They fire on `onPressIn`, never on `onPressOut`, and
 * never from an animation completion callback — a buzz that arrives after the
 * finger has left reads as lag, not feedback.
 */
export const haptics = {
  tap: "light",
  commit: "medium",
  reject: "rigid",
  step: "selection",
  win: "success",
  fail: "error",
} as const;

/**
 * `typography.body` with lineHeight removed, for use on a TextInput.
 *
 * On iOS a lineHeight set on a TextInput is applied as a paragraph style and
 * clips the glyph box, so descenders are cut off: the tails of g, y, p, q and j
 * disappear while you type. Our body token is 15/23, which is comfortable for
 * paragraphs and too tight for an input at that size.
 *
 * Text, not TextInput, keeps the lineHeight — the clipping only affects inputs.
 */
export const inputText: TextStyle = (() => {
  const { lineHeight: _ignored, ...rest } = typography.body;
  return rest;
})();
