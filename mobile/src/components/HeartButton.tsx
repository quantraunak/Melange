import { useEffect, useState } from "react";
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
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    isHearted(userId, kind, targetId).then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, [userId, kind, targetId]);

  if (!userId || userId === ownerId) return null;

  const press = async () => {
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { hearted, error } = await toggleHeart(kind, targetId);
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
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? "Remove heart" : "Heart"}
      style={({ pressed }) => [label ? styles.pill : styles.icon, on && label && styles.pillOn, pressed && { opacity: 0.7 }]}
    >
      <Heart size={18} color={on ? colors.danger : colors.textSecondary} fill={on ? colors.danger : "transparent"} />
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
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  pillOn: { borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft },
  text: { ...typography.bodyStrong, fontFamily: fonts.semibold, color: colors.textSecondary },
  textOn: { color: colors.dangerText },
});
