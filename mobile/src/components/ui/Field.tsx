import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { colors } from "@/lib/theme";

export function Field({
  label,
  hint,
  children,
  ...rest
}: ViewProps & { label?: string; hint?: string }) {
  return (
    <View {...rest} style={[styles.wrap, rest.style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  hint: {
    fontSize: 11,
    color: colors.textSubtle,
  },
});
