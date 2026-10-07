/**
 * Design tokens shared across the app.
 *
 * Light, the original Melange look: white cards on a light grey ground, the
 * blue wordmark, violet for the one affirmative accent, green for Like and
 * red for Pass. Mirrors the Tailwind palette the web app uses. Every screen
 * builds from these; no one-off hex values.
 */

export const colors = {
  // Ground
  bg: "#f3f4f6",          // gray-100
  bgElevated: "#ffffff",

  // Surfaces
  card: "#ffffff",
  surface: "#f9fafb",      // gray-50
  surfaceStrong: "#f3f4f6", // gray-100
  border: "#e5e7eb",       // gray-200
  borderStrong: "#d1d5db", // gray-300
  highlight: "rgba(255,255,255,0.9)",
  scrim: "rgba(17,24,39,0.35)",

  // Ink
  text: "#111827",         // gray-900
  textMuted: "#6b7280",    // gray-500
  textSubtle: "#9ca3af",   // gray-400
  textFaint: "#d1d5db",    // gray-300
  white: "#ffffff",

  // Brand (blue)
  brand: "#1e3a8a",        // blue-900
  onBrand: "#ffffff",
  brandStrong: "#1e40af",  // blue-800
  brandSoft: "#dbeafe",    // blue-100
  brandText: "#1d4ed8",    // blue-700
  brandTabBg: "#2563eb",   // blue-600
  brandOutline: "#818cf8", // indigo-400 (logo stroke)

  // Action
  accent: "#7c3aed",       // violet-600 (chat bubble / CTA / selected)
  accentSoft: "#ede9fe",   // violet-100
  accentMuted: "#6d28d9",  // violet-700 (accent text on light)
  like: "#22c55e",         // green-500
  likeSoft: "#dcfce7",     // green-100
  pass: "#ffffff",
  passText: "#dc2626",     // red-600
  danger: "#dc2626",       // red-600
  dangerSoft: "#fee2e2",   // red-100
  dangerText: "#b91c1c",   // red-700
  warning: "#f59e0b",      // amber-500
  success: "#16a34a",      // green-600
  successSoft: "#dcfce7",  // green-100

  // Chat
  bubbleMe: "#7c3aed",
  bubbleOther: "#f3f4f6",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

/** 8pt scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const typography = {
  brand: {
    fontSize: 24,
    fontWeight: "800" as const,
    fontStyle: "italic" as const,
    color: colors.brandText,
    letterSpacing: -0.5,
  },
  display: {
    fontSize: 30,
    fontWeight: "800" as const,
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  h1: { fontSize: 22, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.4, lineHeight: 27 },
  h2: { fontSize: 18, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  tiny: { fontSize: 11, color: colors.textSubtle },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: colors.textSubtle,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
  },
};

export const shadows = {
  card: {
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Elevated floating surface (project card, tab bar)
  lift: {
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  // Coloured halo under the primary affirmative button
  glow: {
    shadowColor: "#22c55e",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

/** Blur settings for the few frosted surfaces (header, tab bar). Light only. */
export const glass = {
  tint: "light" as const,
  intensity: 30,
  intensityStrong: 50,
};
