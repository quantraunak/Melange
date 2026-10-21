import { StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { sceneLabel } from "@/lib/scenes";
import { colors, fonts, spacing, typography } from "@/lib/theme";

/** "✦ Founding", for after a name. The ✦ is the app's only ornament. */
export const FOUNDING_MARK = "✦";

/**
 * ✦ Founding · scene · @handle, under a name. Renders nothing when there's
 * nothing to say, so callers don't have to check.
 */
export function IdentityLine({
  founding,
  scene,
  handle,
}: {
  founding?: boolean | null;
  scene?: string | null;
  handle?: string | null;
}) {
  const label = sceneLabel(scene);
  if (!founding && !label && !handle) return null;
  return (
    <View style={styles.row}>
      {founding ? <Text style={styles.founding}>{FOUNDING_MARK} Founding</Text> : null}
      {label ? <Chip label={label} size="sm" tone="outline" /> : null}
      {handle ? (
        <Text style={styles.handle} numberOfLines={1}>
          @{handle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  founding: { ...typography.caption, fontFamily: fonts.semibold, color: colors.accentInk },
  handle: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
});
