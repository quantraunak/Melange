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
import { colors, fonts, radii, typography } from "@/lib/theme";

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
            <Text style={[styles.label, dims.type, { color: palette.fg }]}>
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
      return { bg: colors.brand, fg: colors.onBrand, border: undefined };
    case "secondary":
      return { bg: colors.surfaceSunken, fg: colors.brandText, border: undefined };
    case "outline":
      return { bg: colors.surface, fg: colors.text, border: colors.lineStrong };
    case "ghost":
      return { bg: "transparent" as const, fg: colors.text, border: undefined };
    case "danger":
      return { bg: colors.danger, fg: colors.white, border: undefined };
  }
}

function sizeDims(s: Size) {
  switch (s) {
    case "sm":
      return { py: 8, px: 12, type: typography.caption };
    case "md":
      return { py: 12, px: 16, type: typography.bodyStrong };
    case "lg":
      return { py: 16, px: 20, type: typography.headline };
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
    fontFamily: fonts.semibold,
  },
});
