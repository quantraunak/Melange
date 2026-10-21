import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Heart } from "lucide-react-native";

import { colors, fonts, radii, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { isHearted, toggleHeart, type HeartKind } from "@/lib/hearts";

/**
 * Heart a profile or a piece of work. The owner sees who hearted what in
 * Messages, and either of you can then message the other.
 */
export function HeartButton({
  kind,
  targetId,
  ownerId,
  label,
}: {
  kind: HeartKind;
  targetId: string;
  ownerId: string;
  /** Shown next to the heart; omit for an icon-only button. */
  label?: boolean;
}) {
  const { userId } = useAuth();
  // null until the read settles. Rendering an unknown heart as un-hearted is
  // how the first tap silently deleted an existing one. See isHearted.
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: two taps dispatched before a re-render both read the old
  // `busy` from their own closure and both fire toggle_heart, so one inserts,
  // one deletes, and whichever resolves last decides what the pill claims.
  const inFlight = useRef(false);
  // Set once the user acts, so a slow initial read cannot land afterwards and
  // overwrite what they just did.
  const touched = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    isHearted(userId, kind, targetId).then((v) => {
      if (alive && !touched.current) setOn(v);
    });
    return () => {
      alive = false;
    };
  }, [userId, kind, targetId]);

  if (!userId || userId === ownerId) return null;

  const press = async () => {
    // Unknown state: do not guess. Pressing would be a coin flip between
    // adding and removing a heart.
    if (inFlight.current || on === null) return;
    inFlight.current = true;
    touched.current = true;
    setBusy(true);
    const next = !on;
    setOn(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { hearted, error } = await toggleHeart(kind, targetId);
    inFlight.current = false;
    setBusy(false);
    if (error) {
      setOn(!next);
      Alert.alert("Couldn't save that heart", error);
      return;
    }
    setOn(!!hearted);
  };

  return (
    <Pressable
      onPress={press}
      disabled={on === null}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: on === true, disabled: on === null }}
      accessibilityLabel={on ? "Remove heart" : "Heart"}
      style={({ pressed }) => [
        label ? styles.pill : styles.icon,
        on && label && styles.pillOn,
        // Dimmed while we do not yet know whether this is hearted, so the
        // control never looks ready when pressing it would be a guess.
        on === null && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Heart size={18} color={on ? colors.text : colors.textSecondary} fill={on ? colors.text : "transparent"} />
      {label ? <Text style={[styles.text, on && styles.textOn]}>{on ? "Hearted" : "Heart"}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { padding: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  // Hearted is ink: red is kept for destructive confirmation.
  pillOn: { borderColor: colors.text },
  text: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.textSecondary },
  textOn: { color: colors.text },
});
