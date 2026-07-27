import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors, radii } from "@/lib/theme";

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/** Shimmering placeholder block for loading states. */
export function Skeleton({ width = "100%", height = 16, radius = radii.sm, style }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 })
      ),
      -1
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Placeholder matching the SwipeCard's shape, shown while the feed loads. */
export function SwipeCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={240} radius={0} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="35%" height={10} />
          </View>
        </View>
        <Skeleton width="80%" height={16} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={12} style={{ marginTop: 8 }} />
        <Skeleton width="90%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Placeholder matching a MatchRow, shown while messages load. */
export function MatchRowSkeleton() {
  return (
    <View style={styles.matchRow}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="45%" height={13} />
        <Skeleton width="70%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  body: {
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
  },
});
