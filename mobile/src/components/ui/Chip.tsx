import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "@/lib/theme";

type Tone = "neutral" | "accent" | "outline";
type Size = "sm" | "md";

type Props = {
  label: string;
  tone?: Tone;
  size?: Size;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Role chips, pay-type chips, date chips. Pressable when `onPress` is given
 * (role pickers), static otherwise (card and detail). Selected chips flip to
 * the accent so the one colour in the app always means "yes".
 */
export function Chip({ label, tone = "neutral", size = "md", selected, onPress, icon, style }: Props) {
  const bg = selected
    ? colors.accent
    : tone === "accent"
      ? colors.accentSoft
      : tone === "outline"
        ? colors.card
        : colors.surfaceStrong;
  const fg = selected ? colors.white : tone === "accent" ? colors.accentMuted : colors.textMuted;
  const border = selected
    ? colors.accent
    : tone === "accent"
      ? colors.accentSoft
      : tone === "outline"
        ? colors.borderStrong
        : colors.surfaceStrong;
  const dims = size === "sm" ? { py: 4, px: 9, font: 11 } : { py: 7, px: 12, font: 13 };

  const body = (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderColor: border, paddingVertical: dims.py, paddingHorizontal: dims.px },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: fg, fontSize: dims.font }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => (pressed ? { opacity: 0.8, transform: [{ scale: 0.97 }] } : null)}
    >
      {body}
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  label: { fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
