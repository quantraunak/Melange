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
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(99,102,241,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  title: {
    color: colors.brandText,
    fontSize: 21,
    fontWeight: "800",
    fontStyle: "italic",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "#818cf8",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
    letterSpacing: 0.4,
  },
});
