import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme";

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    color: colors.dangerText,
    fontSize: 13,
  },
});
