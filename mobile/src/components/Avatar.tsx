import { Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { colors, fonts, typography } from "@/lib/theme";
import type { CreatorInfo } from "@/lib/db";
import { sized } from "@/lib/imageUrl";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { dim: number; type: TextStyle }> = {
  xs: { dim: 24, type: typography.micro },
  sm: { dim: 32, type: typography.caption },
  md: { dim: 40, type: typography.bodyStrong },
  lg: { dim: 56, type: typography.title },
  xl: { dim: 96, type: typography.display1 },
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
  const { dim, type } = SIZES[size];
  const radius = dim / 2;
  const initial = creator.name?.charAt(0)?.toUpperCase() ?? "?";

  if (creator.avatar_url) {
    return (
      <Image
        source={{ uri: sized(creator.avatar_url, dim, dim) }}
        style={[
          { width: dim, height: dim, borderRadius: radius, backgroundColor: colors.surfaceSunken },
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
      <Text style={[styles.initial, type]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.brandText,
    fontFamily: fonts.semibold,
  },
});
