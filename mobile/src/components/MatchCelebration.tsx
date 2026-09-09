import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Heart, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { colors, radii } from "@/lib/theme";
import type { CreatorInfo } from "@/lib/db";

/**
 * The "it's a match" moment.
 *
 * A match used to be a green toast that slid in for 2.8 seconds and left — the
 * single best thing that can happen in the app, announced the same way as a
 * form error. It also left the person on the deck with no route to the
 * conversation they'd just earned; they had to find it in Messages themselves.
 *
 * This takes over the screen for as long as they want it, shows both faces, and
 * puts the message they're going to send next one tap away.
 */
export function MatchCelebration({
  visible,
  me,
  them,
  onMessage,
  onKeepSwiping,
}: {
  visible: boolean;
  me: Pick<CreatorInfo, "name" | "avatar_url">;
  them: Pick<CreatorInfo, "name" | "avatar_url"> | null;
  onMessage: () => void;
  onKeepSwiping: () => void;
}) {
  const scale = useSharedValue(0.8);
  const heart = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 160 });
      heart.value = withDelay(
        160,
        withSequence(
          withSpring(1.15, { damping: 8, stiffness: 220 }),
          withSpring(1, { damping: 10 })
        )
      );
    } else {
      scale.value = 0.8;
      heart.value = 0;
    }
  }, [visible, scale, heart]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(visible ? 1 : 0, { duration: 160 }),
  }));
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  if (!them) return null;

  const firstName = them.name.split(" ")[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.close}
          onPress={onKeepSwiping}
          hitSlop={12}
          accessibilityLabel="Close"
        >
          <X size={24} color="rgba(255,255,255,0.75)" />
        </Pressable>

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.kicker}>It&apos;s a match</Text>
          <Text style={styles.title}>You and {firstName} liked each other</Text>

          <View style={styles.avatars}>
            <View style={styles.avatarRing}>
              <Avatar creator={me} size="xl" />
            </View>
            <Animated.View style={[styles.heartBadge, heartStyle]}>
              <Heart size={20} color={colors.white} fill={colors.white} />
            </Animated.View>
            <View style={styles.avatarRing}>
              <Avatar creator={them} size="xl" />
            </View>
          </View>

          <Text style={styles.body}>
            Say what you&apos;re thinking for the shoot — the ones that turn into real
            collaborations almost always start the same day.
          </Text>

          <Pressable style={styles.primary} onPress={onMessage} accessibilityRole="button">
            <Text style={styles.primaryText}>Send a message</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onKeepSwiping} accessibilityRole="button">
            <Text style={styles.secondaryText}>Keep swiping</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  close: { position: "absolute", top: 56, right: 24 },
  card: { alignItems: "center", width: "100%", maxWidth: 360, gap: 14 },
  kicker: {
    color: colors.accentMuted,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 32,
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
    borderColor: colors.accentMuted,
  },
  heartBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -14,
    zIndex: 1,
    borderWidth: 3,
    borderColor: "rgba(15,23,42,0.92)",
  },
  body: {
    color: "#cbd5e1",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  primary: {
    marginTop: 4,
    width: "100%",
    backgroundColor: colors.white,
    paddingVertical: 15,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  primaryText: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  secondary: { paddingVertical: 10 },
  secondaryText: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },
});
