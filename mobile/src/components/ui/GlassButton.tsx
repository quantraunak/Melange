import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { glass as glassTokens, shadows } from "@/lib/theme";

/**
 * A circular frosted button that floats over a photo.
 *
 * Light tint and a white rim, so it reads on a bright sky and on a dark
 * interior alike without ever going dark itself. `solid` swaps the frost for
 * one flat colour, which is what the Like button uses — the single
 * affirmative in the app should not be translucent.
 */
export function GlassButton({
  children,
  onPress,
  size = 56,
  solid,
  disabled,
  accessibilityLabel,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  /** Flat background instead of frost. */
  solid?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        styles.base,
        solid ? null : shadows.soft,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: size / 2 }]}>
        {solid ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />
        ) : (
          <>
            <BlurView
              intensity={glassTokens.intensityStrong}
              tint={glassTokens.tint}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tintLayer} pointerEvents="none" />
          </>
        )}
        <View style={styles.content}>{children}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  },
  clip: { flex: 1, overflow: "hidden" },
  tintLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.93 }], opacity: 0.92 },
});
