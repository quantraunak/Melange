import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated from "react-native-reanimated";

import { glass as glassTokens, shadows } from "@/lib/theme";
import { usePressScale } from "@/lib/usePressScale";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A circular control floating over a photograph.
 *
 * Glass lives in exactly two places in this app — here and the tab bar. The
 * rim is a dark hairline rather than a white one: a white rim is crisp where
 * the photo behind it is dark and vanishes where it is bright, so it only
 * ever works on half an image.
 *
 * `solid` swaps the frost for one flat colour, which the Like button uses —
 * the single affirmative action should not be translucent.
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
  const press = usePressScale("circle", { haptic: !disabled });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={disabled ? undefined : press.onPressIn}
      onPressOut={disabled ? undefined : press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      // 42–48pt controls sit under Apple's 44pt floor without this.
      hitSlop={10}
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        styles.base,
        solid ? shadows.float : shadows.card,
        press.style,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: size / 2 }]}>
        {solid ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />
        ) : (
          <>
            <BlurView
              intensity={glassTokens.intensity}
              tint={glassTokens.tint}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tintLayer} pointerEvents="none" />
          </>
        )}
        <View style={styles.content}>{children}</View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glassTokens.rim,
    overflow: "hidden",
  },
  clip: { flex: 1, overflow: "hidden" },
  tintLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glassTokens.tintLayer,
  },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
});
