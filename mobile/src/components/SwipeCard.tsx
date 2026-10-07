import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarDays, Sparkles, Info, MapPin } from "lucide-react-native";

import { colors, radii, shadows, typography } from "@/lib/theme";
import { payLabel, projectDates, projectRoles, type PostWithCreator } from "@/lib/db";
import { Avatar } from "./Avatar";
import { Chip, ChipRow } from "./ui/Chip";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const ROTATION_MAX = 12; // degrees
export const CARD_HEIGHT = Math.min(Math.round(SCREEN_H * 0.6), 600);

export type SwipeDir = "left" | "right";

/**
 * The project card. The photo on top, the collab on a white caption below
 * it: who they're looking for first (that is what people scan for), then
 * the title, logline, dates, place and pay, then who posted it. Swipe right
 * to apply, left to pass.
 */

function Poster({ post, dim }: { post: PostWithCreator; dim?: boolean }) {
  const uri = post.media_urls?.[0];
  return (
    <View style={[styles.poster, dim && { opacity: 0.7 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <View style={styles.placeholder}>
          <Sparkles size={56} color={colors.textFaint} strokeWidth={1.2} />
          <Text style={styles.placeholderText}>No poster yet</Text>
        </View>
      )}
    </View>
  );
}

function Caption({ post }: { post: PostWithCreator }) {
  const roles = projectRoles(post);
  const dates = projectDates(post);
  const pay = payLabel(post);
  const shown = roles.slice(0, 3);
  const extra = roles.length - shown.length;

  return (
    <View style={styles.captionWrap}>
      <View style={styles.caption}>
        {roles.length ? (
          <ChipRow>
            {shown.map((r) => (
              <Chip key={r} label={r} size="sm" tone="accent" />
            ))}
            {extra > 0 ? <Chip label={`+${extra}`} size="sm" tone="outline" /> : null}
          </ChipRow>
        ) : null}

        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        {post.description ? (
          <Text style={styles.logline} numberOfLines={2}>
            {post.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {dates ? (
            <View style={styles.meta}>
              <CalendarDays size={14} color={colors.textSubtle} />
              <Text style={styles.metaText} numberOfLines={1}>{dates}</Text>
            </View>
          ) : null}
          {post.location ? (
            <View style={styles.meta}>
              <MapPin size={14} color={colors.textSubtle} />
              <Text style={styles.metaText} numberOfLines={1}>{post.location}</Text>
            </View>
          ) : null}
          {pay ? <Chip label={pay} size="sm" /> : null}
        </View>

        <View style={styles.byRow}>
          <Avatar creator={post.creator} size="sm" />
          <Text style={styles.byText} numberOfLines={1}>
            <Text style={styles.byName}>{post.creator.name}</Text>
            {post.creator.verification_status === "verified" ? " ✓" : ""}
            {post.creator.role ? `  ·  ${post.creator.role}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Non-interactive card shown peeking behind the active card for stack depth. */
export function SwipeCardBehind({ post }: { post: PostWithCreator }) {
  const scale = useSharedValue(0.94);
  const translateY = useSharedValue(10);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.card, styles.behindCard, animatedStyle]} pointerEvents="none">
      <Poster post={post} dim />
      <Caption post={post} />
    </Animated.View>
  );
}

type Props = {
  post: PostWithCreator;
  onSwipe: (dir: SwipeDir) => void;
  onOpenDetails: () => void;
  disabled?: boolean;
  /** Bumped by parent to programmatically trigger swipe via buttons. */
  pendingButtonSwipe: SwipeDir | null;
  /** Notify parent that an animated button-driven swipe is finished. */
  onButtonSwipeComplete: () => void;
};

export function SwipeCard({
  post,
  onSwipe,
  onOpenDetails,
  disabled,
  pendingButtonSwipe,
  onButtonSwipeComplete,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const entrance = useSharedValue(0);

  const triggerSwipe = (dir: SwipeDir) => {
    Haptics.impactAsync(
      dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onSwipe(dir);
  };

  useEffect(() => {
    entrance.value = 0;
    entrance.value = withSpring(1, { damping: 20, stiffness: 260 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  useEffect(() => {
    if (!pendingButtonSwipe) return;
    const target = pendingButtonSwipe === "right" ? SCREEN_W * 1.4 : -SCREEN_W * 1.4;
    tx.value = withTiming(target, { duration: 260, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) {
        runOnJS(triggerSwipe)(pendingButtonSwipe);
        runOnJS(onButtonSwipeComplete)();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingButtonSwipe]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const vx = e.velocityX;
      const wentRight = dx > SWIPE_THRESHOLD || vx > 800;
      const wentLeft = dx < -SWIPE_THRESHOLD || vx < -800;

      if (wentRight) {
        tx.value = withTiming(SCREEN_W * 1.4, { duration: 220 }, (done) => {
          if (done) runOnJS(triggerSwipe)("right");
        });
      } else if (wentLeft) {
        tx.value = withTiming(-SCREEN_W * 1.4, { duration: 220 }, (done) => {
          if (done) runOnJS(triggerSwipe)("left");
        });
      } else {
        tx.value = withSpring(0, { damping: 18, stiffness: 220 });
        ty.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = (tx.value / SCREEN_W) * ROTATION_MAX;
    return {
      opacity: entrance.value,
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + (1 - entrance.value) * 16 },
        { scale: 0.96 + entrance.value * 0.04 },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const applyOverlay = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, tx.value / SWIPE_THRESHOLD)),
  }));
  const passOverlay = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, -tx.value / SWIPE_THRESHOLD)),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Poster post={post} />

        <Pressable
          onPress={onOpenDetails}
          style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.8 }]}
          hitSlop={10}
          accessibilityLabel="Project details"
        >
          <Info size={18} color={colors.brandText} />
        </Pressable>

        <Animated.View style={[styles.stamp, styles.stampApply, applyOverlay]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.like }]}>APPLY</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampPass, passOverlay]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.passText }]}>PASS</Text>
        </Animated.View>

        <Caption post={post} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lift,
  },
  behindCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  poster: {
    flex: 1,
    backgroundColor: colors.surfaceStrong,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceStrong,
  },
  placeholderText: { ...typography.tiny, color: colors.textSubtle },
  infoBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  stamp: {
    position: "absolute",
    top: 22,
    borderWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  stampApply: { left: 20, borderColor: colors.like, transform: [{ rotate: "-12deg" }] },
  stampPass: { right: 20, borderColor: colors.passText, transform: [{ rotate: "12deg" }] },
  stampText: { fontWeight: "900", fontSize: 24, letterSpacing: 3 },
  captionWrap: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  caption: {
    padding: 16,
    paddingTop: 14,
    gap: 8,
  },
  title: {
    ...typography.h1,
  },
  logline: {
    ...typography.small,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "60%" },
  metaText: { ...typography.small, color: colors.textMuted },
  byRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  byText: { ...typography.small, flex: 1 },
  byName: { color: colors.text, fontWeight: "700" },
});
