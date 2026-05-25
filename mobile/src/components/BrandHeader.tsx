import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";
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
        <Logo size={36} stroke={colors.brandOutline} />
        <View>
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
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    fontStyle: "italic",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#bfdbfe",
    fontSize: 11,
    marginTop: -2,
  },
});
