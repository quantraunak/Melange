import { Image, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";
import type { CreatorInfo } from "@/lib/db";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { dim: number; font: number }> = {
  xs: { dim: 24, font: 11 },
  sm: { dim: 32, font: 13 },
  md: { dim: 40, font: 15 },
  lg: { dim: 56, font: 19 },
  xl: { dim: 96, font: 32 },
};

export function Avatar({
  creator,
  size = "md",
  style,
}: {
  creator: Pick<CreatorInfo, "name" | "avatar_url">;
  size?: Size;
  style?: ViewStyle | ImageStyle;
}) {
  const { dim, font } = SIZES[size];
  const radius = dim / 2;
  const initial = creator.name?.charAt(0)?.toUpperCase() ?? "?";

  if (creator.avatar_url) {
    return (
      <Image
        source={{ uri: creator.avatar_url }}
        style={[
          { width: dim, height: dim, borderRadius: radius, backgroundColor: colors.brandSoft },
          style as ImageStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dim, height: dim, borderRadius: radius },
        style as ViewStyle,
      ]}
    >
      <Text style={[styles.initial, { fontSize: font }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.brandText,
    fontWeight: "700",
  },
});
