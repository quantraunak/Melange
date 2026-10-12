import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * A white-to-transparent wash under the status bar, on the two screens that
 * are edge-to-edge photographs.
 *
 * It has exactly one job: guarantee a light ground beneath the dark
 * status-bar glyphs whatever photo is behind them. It replaces an eight-band
 * fade that ran 340pt down the image and bleached the bottom 40% of every
 * photo; the bottom needs no wash at all now that the caption sits on an
 * opaque plate.
 *
 * Built from stacked bands rather than expo-linear-gradient: that pod cannot
 * currently be compiled in this project (fmt fails under Xcode 26), and one
 * dependency is not worth a broken toolchain. The old fade's problem was a
 * 0.117 alpha step at its hard edge — roughly 8–12 L*, where the visible
 * threshold is about 1. Here the same total opacity is spread over 20 bands
 * instead of 8 and across a third of the distance, so each step is 0.031
 * alpha, and it sits under the status bar rather than across the subject.
 */
const BANDS = 20;
const PEAK = 0.62;

export function Scrim({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  const band = height / BANDS;
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, right: 0, top: 0, height }, style]}
    >
      {Array.from({ length: BANDS }, (_, i) => {
        // Weight gathers at the top, where the glyphs are, and tails to nothing.
        const t = 1 - i / BANDS;
        return (
          <View
            key={i}
            style={{
              height: band,
              backgroundColor: `rgba(255,255,255,${(t * t * PEAK).toFixed(3)})`,
            }}
          />
        );
      })}
    </View>
  );
}
