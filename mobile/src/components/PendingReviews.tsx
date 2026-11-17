import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Star } from "lucide-react-native";

import { getMyPendingReviews, type PendingReview } from "@/lib/projects";
import { colors, fonts, radii, spacing, typography } from "@/lib/theme";

/**
 * "How was working with Ana on "Rooftop"?" for each finished project you
 * were on and haven't reviewed. Reviews show on profiles once both people
 * have written theirs.
 */
export function PendingReviews() {
  const router = useRouter();
  const [rows, setRows] = useState<PendingReview[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyPendingReviews().then((r) => {
        if (alive) setRows(r);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  if (!rows.length) return null;
  return (
    <View style={styles.wrap}>
      {rows.map((r) => {
        const first = r.other_name.split(" ")[0];
        return (
          <Pressable
            key={`${r.match_id}-${r.post_id}`}
            onPress={() => router.push({ pathname: "/review/[matchId]", params: { matchId: r.match_id } })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Star size={18} color={colors.brandText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                How was working with {first} on &quot;{r.title}&quot;?
              </Text>
              <Text style={styles.body}>Leave a review. It shows once {first} reviews you too.</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  title: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.text },
  body: { ...typography.caption, color: colors.textSecondary },
});
