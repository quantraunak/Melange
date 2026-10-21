import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send } from "lucide-react-native";
import { colors, inputText, radii } from "@/lib/theme";

/** The input bar at the foot of every conversation, one-on-one or a night's. */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  sending,
  placeholder = "Type a message...",
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
}) {
  const disabled = !value.trim() || sending;
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.bar}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={onSend}
          disabled={disabled}
          style={[styles.send, disabled && { opacity: 0.4 }]}
          accessibilityLabel="Send message"
        >
          <Send size={18} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    ...inputText,
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    maxHeight: 120,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
