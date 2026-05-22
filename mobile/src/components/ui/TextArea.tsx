import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radii } from "@/lib/theme";

export const TextArea = forwardRef<TextInput, TextInputProps>(function TextArea(
  { style, ...rest },
  ref
) {
  return (
    <TextInput
      ref={ref}
      multiline
      placeholderTextColor={colors.textSubtle}
      textAlignVertical="top"
      style={[styles.input, style]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 96,
  },
});
