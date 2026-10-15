import { forwardRef } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radii, inputText } from "@/lib/theme";

type Props = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { containerStyle, leading, trailing, style, ...rest },
  ref
) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          leading ? { paddingLeft: 36 } : null,
          trailing ? { paddingRight: 36 } : null,
          style,
        ]}
        {...rest}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    width: "100%",
  },
  input: { ...inputText, backgroundColor: colors.surfaceSunken, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, width: "100%" },
  leading: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  trailing: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
});
