import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, typography } from "@/lib/theme";

/**
 * The large left-aligned title every tab opens with. One component so the
 * tabs can't drift into three sizes for one rank of heading again.
 */
export function ScreenTitle({
  title,
  action,
  right,
}: {
  title: string;
  /** A text action on the right ("Add", "Host"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Anything else on the right, when a text action won't do. */
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
        >
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 38 },
  title: { ...typography.display1, flex: 1 },
  action: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
});
