import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/lib/theme";

/**
 * A flat band of paper under the status bar, on the screens that are
 * edge-to-edge photographs.
 *
 * Its one job is a light ground beneath the dark status-bar glyphs whatever
 * photo is behind them. It used to be a white-to-transparent wash; a solid
 * band of paper does the same job without fading anything over the photo,
 * and reads as the page the photograph is pinned to.
 */
export function Scrim({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        { position: "absolute", left: 0, right: 0, top: 0, height, backgroundColor: colors.bg },
        style,
      ]}
    />
  );
}
