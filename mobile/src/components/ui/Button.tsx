import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radii } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "style" | "children"> & {
  title?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  children?: React.ReactNode;
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading,
  leadingIcon,
  trailingIcon,
  style,
  fullWidth,
  disabled,
  children,
  ...rest
}: Props) {
  const palette = variantPalette(variant);
  const dims = sizeDims(size);

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border ? 1 : 0,
          paddingVertical: dims.py,
          paddingHorizontal: dims.px,
          opacity: pressed ? 0.85 : disabled || loading ? 0.55 : 1,
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.inner}>
          {leadingIcon}
          {title ? (
            <Text style={[styles.label, { color: palette.fg, fontSize: dims.font }]}>
              {title}
            </Text>
          ) : null}
          {children}
          {trailingIcon}
        </View>
      )}
    </Pressable>
  );
}

function variantPalette(v: Variant) {
  switch (v) {
    case "primary":
      return { bg: colors.brand, fg: colors.white, border: undefined };
    case "secondary":
      return { bg: colors.brandSoft, fg: colors.brandText, border: undefined };
    case "outline":
      return { bg: colors.card, fg: colors.text, border: colors.borderStrong };
    case "ghost":
      return { bg: "transparent" as const, fg: colors.text, border: undefined };
    case "danger":
      return { bg: colors.danger, fg: colors.white, border: undefined };
  }
}

function sizeDims(s: Size) {
  switch (s) {
    case "sm":
      return { py: 8, px: 12, font: 13 };
    case "md":
      return { py: 12, px: 16, font: 15 };
    case "lg":
      return { py: 14, px: 20, font: 16 };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontWeight: "600",
  },
});
