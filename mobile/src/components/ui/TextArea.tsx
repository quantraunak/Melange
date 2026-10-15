import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radii, inputText } from "@/lib/theme";

export const TextArea = forwardRef<TextInput, TextInputProps>(function TextArea(
  { style, ...rest },
  ref
) {
  return (
    <TextInput
      ref={ref}
      multiline
      placeholderTextColor={colors.textTertiary}
      textAlignVertical="top"
      style={[styles.input, style]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: { ...inputText, backgroundColor: colors.surfaceSunken, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, minHeight: 96 },
});
