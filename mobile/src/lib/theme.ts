/**
 * Design tokens shared across the app.
 * Mirrors the Tailwind palette used by the web version of Melange.
 */

export const colors = {
  // Brand
  brand: "#1e3a8a",       // blue-900
  brandStrong: "#1e40af", // blue-800
  brandSoft: "#dbeafe",   // blue-100
  brandText: "#1d4ed8",   // blue-700
  brandTabBg: "#2563eb",  // blue-600
  brandOutline: "#818cf8", // indigo-400 (logo stroke)

  // Action
  accent: "#7c3aed",       // violet-600 (chat bubble / CTA)
  accentSoft: "#8b5cf6",   // violet-500
  accentMuted: "#a78bfa",  // violet-400
  like: "#22c55e",         // green-500
  pass: "#f3f4f6",         // gray-100
  danger: "#dc2626",       // red-600
  dangerSoft: "#fee2e2",   // red-100
  dangerText: "#b91c1c",   // red-700
  warning: "#f59e0b",      // amber-500

  // Surfaces
  bg: "#f3f4f6",           // gray-100
  card: "#ffffff",
  surface: "#f9fafb",      // gray-50
  border: "#e5e7eb",       // gray-200
  borderStrong: "#d1d5db", // gray-300

  // Text
  text: "#111827",         // gray-900
  textMuted: "#6b7280",    // gray-500
  textSubtle: "#9ca3af",   // gray-400
  textFaint: "#d1d5db",    // gray-300
  white: "#ffffff",

  // Misc
  bubbleMe: "#7c3aed",
  bubbleOther: "#f3f4f6",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const typography = {
  brand: {
    fontSize: 22,
    fontWeight: "800" as const,
    fontStyle: "italic" as const,
    color: colors.white,
    letterSpacing: -0.5,
  },
  h1: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.textMuted },
  tiny: { fontSize: 11, color: colors.textSubtle },
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
