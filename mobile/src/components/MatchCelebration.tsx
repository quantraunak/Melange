import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Sparkles, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { colors, radii, shadows, typography } from "@/lib/theme";
import type { CreatorInfo } from "@/lib/db";

/**
 * The match moment: both people said yes to each other's project.
 *
 * A full-screen frosted sheet, both faces, the project it happened on, and the
 * message they are about to send one tap away. It stays up as long as they
 * want it; the single best thing that can happen in the app is not a toast.
 */
export function MatchCelebration({
  visible,
  me,
  them,
  projectTitle,
  onMessage,
  onKeepSwiping,
  copy,
}: {
  visible: boolean;
  me: Pick<CreatorInfo, "name" | "avatar_url">;
  them: Pick<CreatorInfo, "name" | "avatar_url"> | null;
  projectTitle?: string;
  onMessage: () => void;
  onKeepSwiping: () => void;
  /**
   * Words for a match that didn't come from a project, such as a mutual
   * heart after a night. The moment is the same; only what led to it differs.
   */
  copy?: { kicker: string; title: string; body: string; dismiss: string };
}) {
  const scale = useSharedValue(0.86);
  const badge = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 170 });
      badge.value = withDelay(
        160,
        withSequence(
          withSpring(1.15, { damping: 8, stiffness: 220 }),
          withSpring(1, { damping: 10 })
        )
      );
    } else {
      scale.value = 0.86;
      badge.value = 0;
    }
  }, [visible, scale, badge]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(visible ? 1 : 0, { duration: 160 }),
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));

  if (!them) return null;

  const firstName = them.name.split(" ")[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={styles.backdrop}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />

        <Pressable style={styles.close} onPress={onKeepSwiping} hitSlop={12} accessibilityLabel="Close">
          <X size={24} color={colors.text} />
        </Pressable>

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.kicker}>{copy ? copy.kicker : "You're on the list"}</Text>
          <Text style={styles.title}>
            {copy ? copy.title : `${firstName} picked you${projectTitle ? ` for ${projectTitle}` : " too"}`}
          </Text>

          <View style={styles.avatars}>
            <View style={styles.avatarRing}>
              <Avatar creator={me} size="xl" />
            </View>
            <Animated.View style={[styles.badge, badgeStyle]}>
              <Sparkles size={20} color={colors.white} />
            </Animated.View>
            <View style={styles.avatarRing}>
              <Avatar creator={them} size="xl" />
            </View>
          </View>

          <Text style={styles.body}>
            {copy
              ? copy.body
              : "Say when you're free and what you'd bring. Collabs that happen are the ones where someone writes first, today."}
          </Text>

          <Pressable style={styles.primary} onPress={onMessage} accessibilityRole="button">
            <Text style={styles.primaryText}>Say hi</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onKeepSwiping} accessibilityRole="button">
            <Text style={styles.secondaryText}>{copy ? copy.dismiss : "Keep looking"}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  close: { position: "absolute", top: 56, right: 24 },
  card: {
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 22,
    ...shadows.plate,
  },
  kicker: { ...typography.eyebrow, color: colors.accentInk },
  title: {
    ...typography.display1,
    color: colors.brand,
    textAlign: "center",
  },
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  avatarRing: {
    padding: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -14,
    zIndex: 1,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.card,
  },
  body: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  primary: {
    marginTop: 4,
    width: "100%",
    backgroundColor: colors.brand,
    paddingVertical: 15,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  primaryText: { ...typography.headline, color: colors.onBrand },
  secondary: { paddingVertical: 10 },
  secondaryText: { ...typography.bodyStrong, color: colors.textSecondary },
});
