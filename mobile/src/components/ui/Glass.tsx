import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, glass as glassTokens, radii, shadows } from "@/lib/theme";

type Props = ViewProps & {
  /** "strong" blurs harder and sits higher; use for sheets, bars and the card caption. */
  variant?: "soft" | "strong" | "flat";
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Drop shadow (off by default: most glass sits on other glass). */
  elevated?: boolean;
  children?: React.ReactNode;
};

/**
 * A translucent surface: real blur behind, a 1px lighter top edge, and a thin
 * border. Everything that floats over the ground (cards, rows, bars, sheets)
 * is one of these, so the whole app shares one material.
 */
export function Glass({
  variant = "soft",
  radius = radii.xl,
  style,
  elevated,
  children,
  ...rest
}: Props) {
  const intensity =
    variant === "strong" ? glassTokens.intensityStrong : variant === "flat" ? 0 : glassTokens.intensity;
  return (
    <View
      {...rest}
      style={[
        styles.outer,
        { borderRadius: radius },
        elevated ? shadows.card : null,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {intensity > 0 ? (
          <BlurView intensity={intensity} tint={glassTokens.tint} style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: variant === "strong" ? colors.surfaceStrong : colors.card },
          ]}
        />
        <View pointerEvents="none" style={styles.edge} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  clip: { overflow: "hidden" },
  edge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.highlight,
  },
  content: { position: "relative" },
});
