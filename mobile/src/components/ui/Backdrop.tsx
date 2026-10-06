import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { colors } from "@/lib/theme";

/**
 * The ground every screen sits on: near-black with two soft lights, one coral
 * and one cool, blurred into the dark. Static (no animation) so it costs
 * nothing, and the glass surfaces above it have something to refract.
 */
export function Backdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.ground} />
      <View style={[styles.light, styles.coral]} />
      <View style={[styles.light, styles.cool]} />
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  light: { position: "absolute", borderRadius: 999, opacity: 0.55 },
  coral: {
    width: 420,
    height: 420,
    top: -160,
    right: -140,
    backgroundColor: "#E55A4C",
  },
  cool: {
    width: 520,
    height: 520,
    bottom: -260,
    left: -220,
    backgroundColor: "#3B4CCA",
  },
});
