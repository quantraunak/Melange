import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, glass as glassTokens, radii, shadows } from "@/lib/theme";

type Props = ViewProps & {
  /** "strong" is frosted (blur behind) for bars that float over content; "soft" is a plain white card; "flat" is the grey surface. */
  variant?: "soft" | "strong" | "flat";
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Drop shadow. */
  elevated?: boolean;
  children?: React.ReactNode;
};

/**
 * A white surface with a hairline border. Cards, rows and sheets are one of
 * these so the whole app shares one material. The "strong" variant adds a
 * light frost behind it, used only for the floating tab bar.
 */
export function Glass({
  variant = "soft",
  radius = radii.xl,
  style,
  elevated,
  children,
  ...rest
}: Props) {
  const frosted = variant === "strong";
  // Layout that governs the children (direction, gap, padding) has to land on
  // the inner content view; everything else (size, margins, flex in the parent,
  // borders) stays on the outer frame. Without this split a row style on a
  // Glass stacked its children vertically.
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const inner: Record<string, unknown> = {};
  const outer: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    (CONTENT_KEYS.has(k) || k.startsWith("padding") ? inner : outer)[k] = v;
  }
  return (
    <View
      {...rest}
      style={[
        styles.outer,
        { borderRadius: radius },
        elevated ? shadows.card : null,
        outer as ViewStyle,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {frosted ? (
          <BlurView intensity={glassTokens.intensityStrong} tint={glassTokens.tint} style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: frosted
                ? "rgba(255,255,255,0.82)"
                : variant === "flat"
                  ? colors.surface
                  : colors.card,
            },
          ]}
        />
        <View style={[styles.content, inner as ViewStyle]}>{children}</View>
      </View>
    </View>
  );
}

const CONTENT_KEYS = new Set([
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "alignContent",
  "gap",
  "rowGap",
  "columnGap",
]);

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  clip: { overflow: "hidden" },
  content: { position: "relative" },
});
