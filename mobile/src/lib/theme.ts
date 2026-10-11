/**
 * Design tokens. The single source of truth for every visual decision.
 *
 * Implemented from docs/DESIGN_SPEC.md §2 verbatim. Read that document before
 * changing anything here: every value below was measured against screenshots,
 * not chosen. The rules it encodes, in one paragraph:
 *
 *   Two hues. Blue is structure (wordmark, nav, primary buttons, links),
 *   violet is affirmative (like, match, selected) and nothing else. Light
 *   palette only — there is no dark theme and glass never means dark chrome.
 *   Content surfaces are opaque white and run edge to edge; chrome floats
 *   inset at GUTTER and is the only thing allowed to be glass. One gutter,
 *   four radii, one spacing scale, nine type tokens, three elevations.
 *
 * An ESLint rule bans `fontSize` outside this file. If you need a size that
 * is not here, the answer is almost always that you need a different token.
 */

import type { TextStyle } from "react-native";
import { Easing } from "react-native-reanimated";

export const colors = {
  // Ground and surfaces
  bg: "#f3f4f6",
  surface: "#ffffff",
  surfaceSunken: "#f9fafb", // input wells only
  line: "rgba(17,24,39,0.10)", // every hairline
  lineStrong: "#e5e7eb", // input wells, disabled outlines
  scrim: "rgba(17,24,39,0.35)",

  // Ink. textTertiary is legal on #ffffff only (4.83:1); on bg it is 4.39 and fails.
  text: "#111827",
  textSecondary: "#4b5563",
  textTertiary: "#6b7280",
  /** Non-text strokes, dividers, placeholder glyphs. Never a text colour. */
  iconFaint: "#9ca3af",
  white: "#ffffff",

  // Blue is structure.
  brand: "#1e3a8a",
  brandText: "#1d4ed8", // text links only
  onBrand: "#ffffff",

  // Violet is yes.
  accent: "#7c3aed",
  accentSoft: "#f5f3ff",
  accentInk: "#6d28d9",
  onAccent: "#ffffff",

  // Red is destructive confirmation. It is not a UI colour.
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  dangerText: "#b91c1c",

  // Chat
  bubbleMe: "#7c3aed",
  bubbleOther: "#f3f4f6",
};

/** Four values. Nothing else. sm chips/inputs/thumbs · md inner cards · lg plates/sheets/bar · pill capsules */
export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
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
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
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
 * Three levels. `float` is the only shadow allowed over a photograph — anything
 * softer is below the perceptual floor on an image. A surface has an edge or a
 * shadow, never both.
 */
export const shadows = {
  card: {
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  plate: {
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  float: {
    shadowColor: "#0b1220",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
