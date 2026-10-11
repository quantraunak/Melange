import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * A vertical white-to-transparent fade, built from stacked bands.
 *
 * expo-linear-gradient is not a dependency here and this is the only place
 * the app needs a gradient, so eight eased bands do the job: at this height
 * the steps are under a pixel of perceived difference, and it costs nothing
 * at runtime. Purely decorative, so it never takes touches.
 */
export function Fade({
  height = 120,
  bands = 8,
  color = "255,255,255",
  to = 0.92,
  style,
}: {
  height?: number;
  bands?: number;
  /** "r,g,b" — the colour the fade arrives at. */
  color?: string;
  /** Peak opacity at the solid end. */
  to?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const band = height / bands;
  return (
    <View pointerEvents="none" style={[{ height }, style]}>
      {Array.from({ length: bands }, (_, i) => {
        // Ease-in so the top stays nearly clear and the weight gathers at the
        // bottom, which is where the text sits.
        const t = (i + 1) / bands;
        return (
          <View
            key={i}
            style={{
              height: band,
              backgroundColor: `rgba(${color},${(t * t * to).toFixed(3)})`,
            }}
          />
        );
      })}
    </View>
  );
}

export const fadeStyles = StyleSheet.create({
  overPanel: { position: "absolute", left: 0, right: 0 },
});
