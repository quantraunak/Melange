import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * A white-to-transparent wash under the status bar on the two screens that
 * are edge-to-edge photographs.
 *
 * This is the app's only gradient and it has exactly one job: guarantee a
 * light ground beneath the dark status-bar glyphs whatever photo is behind
 * them. It replaces an eight-band stacked-View fade whose final step was
 * ~0.117 alpha across one hard pixel edge — visible banding, and it bleached
 * the bottom 40% of every image. The bottom of the photo needs no wash at all
 * now that the caption sits on an opaque plate.
 */
export function Scrim({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.62)", "rgba(255,255,255,0)"]}
      style={[styles.base, { height }, style]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  base: { position: "absolute", left: 0, right: 0, top: 0 },
});
