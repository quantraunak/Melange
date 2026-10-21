import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { colors, GUTTER, motion, radii, spacing, typography } from "@/lib/theme";
import type { CreatorInfo } from "@/lib/db";

/**
 * The match moment: both people said yes to each other's project.
 *
 * A full page of paper, set like a note: what happened in one line of the
 * display serif, both faces side by side, and the message they are about to
 * send one tap away. No confetti, no glow — the news is the decoration. It
 * stays up as long as they want it.
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
  const insets = useSafeAreaInsets();
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = visible
      ? withTiming(1, { duration: motion.durations.slow, easing: motion.easings.enter })
      : 0;
  }, [visible, rise]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 12 }],
  }));

  if (!them) return null;

  const firstName = them.name.split(" ")[0];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={[styles.page, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable style={styles.close} onPress={onKeepSwiping} hitSlop={12} accessibilityLabel="Close">
          <X size={24} color={colors.text} />
        </Pressable>

        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.kicker}>{copy ? copy.kicker : "It's mutual"}</Text>
          <Text style={styles.title}>
            {copy ? copy.title : `${firstName} picked you${projectTitle ? ` for ${projectTitle}` : " too"}.`}
          </Text>

          <View style={styles.rule} />

          <View style={styles.people}>
            <View style={styles.person}>
              <Avatar creator={me} size="lg" />
              <Text style={styles.name} numberOfLines={1}>
                You
              </Text>
            </View>
            <View style={styles.person}>
              <Avatar creator={them} size="lg" />
              <Text style={styles.name} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          </View>

          <Text style={styles.body}>
            {copy
              ? copy.body
              : `Tell ${firstName} when you're free and what you'd bring. The collabs that happen are the ones where someone writes first.`}
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
            onPress={onMessage}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Message {firstName}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onKeepSwiping} accessibilityRole="button">
            <Text style={styles.secondaryText}>{copy ? copy.dismiss : "Keep looking"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: GUTTER + spacing.sm,
  },
  close: { alignSelf: "flex-end", padding: spacing.xs },
  content: { flex: 1, justifyContent: "center", gap: spacing.md },
  kicker: { ...typography.eyebrow },
  title: { ...typography.display1 },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: spacing.md,
  },
  people: { flexDirection: "row", gap: spacing.xl },
  person: { alignItems: "flex-start", gap: spacing.sm },
  name: { ...typography.caption, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  actions: { gap: spacing.xs },
  primary: {
    backgroundColor: colors.brand,
    paddingVertical: 15,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryText: { ...typography.headline, color: colors.onBrand },
  secondary: { paddingVertical: spacing.md, alignItems: "center" },
  secondaryText: { ...typography.bodyStrong, color: colors.textSecondary },
});
