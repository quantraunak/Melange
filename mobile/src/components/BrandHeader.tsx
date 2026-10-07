import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, typography } from "@/lib/theme";
import { Logo } from "./Logo";

export function BrandHeader({
  right,
  subtitle = "Creative Collaborations",
  style,
}: {
  right?: React.ReactNode;
  subtitle?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.left}>
        <Logo size={34} stroke={colors.brandOutline} />
        <View style={styles.titles}>
          <Text style={styles.title}>Melange</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titles: { gap: 1 },
  title: typography.brand,
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.brandTabBg,
  },
});
