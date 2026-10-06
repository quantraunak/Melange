/**
 * Design tokens shared across the app.
 *
 * Dark-first, glass surfaces. One accent (coral, per docs/DESIGN.md) for the
 * affirmative moments: apply, match, credit. Everything else is layers of
 * white at low opacity over a near-black ground, so posters and stills carry
 * the colour. Every screen builds from these; no one-off hex values.
 */

export const colors = {
  // Ground
  bg: "#0B0C10",
  bgElevated: "#12131A",

  // Glass layers (white at increasing opacity)
  card: "rgba(255,255,255,0.06)",
  surface: "rgba(255,255,255,0.08)",
  surfaceStrong: "rgba(255,255,255,0.12)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  highlight: "rgba(255,255,255,0.22)",
  scrim: "rgba(5,6,10,0.72)",

  // Ink
  text: "#F5F5F2",
  textMuted: "#B8BAC2",
  textSubtle: "#7E818C",
  textFaint: "#4A4D58",
  white: "#FFFFFF",

  // Primary action is ink on light (inverted on the dark ground)
  brand: "#F5F5F2",
  onBrand: "#0B0C10",
  brandStrong: "#FFFFFF",
  brandSoft: "rgba(255,255,255,0.10)",
  brandText: "#F5F5F2",
  brandTabBg: "rgba(255,255,255,0.10)",
  brandOutline: "#E55A4C",

  // The one accent
  accent: "#E55A4C",
  accentSoft: "rgba(229,90,76,0.18)",
  accentMuted: "#F3A094",
  like: "#E55A4C",
  pass: "rgba(255,255,255,0.10)",
  danger: "#EF4444",
  dangerSoft: "rgba(239,68,68,0.14)",
  dangerText: "#FCA5A5",
  warning: "#F5B544",
  success: "#4ADE80",
  successSoft: "rgba(74,222,128,0.14)",

  // Chat
  bubbleMe: "#E55A4C",
  bubbleOther: "rgba(255,255,255,0.10)",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  brand: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: colors.text,
    letterSpacing: -0.6,
  },
  display: {
    fontSize: 30,
    fontWeight: "800" as const,
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  h1: { fontSize: 24, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 18, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.textMuted },
  tiny: { fontSize: 11, color: colors.textSubtle },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: colors.textSubtle,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // Elevated floating surface (shoot card, primary CTAs)
  lift: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  glow: {
    shadowColor: "#E55A4C",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

/** Blur settings for glass surfaces (expo-blur). */
export const glass = {
  tint: "dark" as const,
  intensity: 40,
  intensityStrong: 70,
};
