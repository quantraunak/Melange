import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
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
import { CalendarDays, Clapperboard, Info, MapPin } from "lucide-react-native";

import { colors, glass, radii, shadows, typography } from "@/lib/theme";
import { payLabel, shootDates, shootRoles, type PostWithCreator } from "@/lib/db";
import { Avatar } from "./Avatar";
import { Chip, ChipRow } from "./ui/Chip";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const ROTATION_MAX = 12; // degrees
export const CARD_HEIGHT = Math.min(Math.round(SCREEN_H * 0.6), 600);

export type SwipeDir = "left" | "right";

/**
 * The shoot card. A poster fills the whole card; the crew call sits on a
 * glass caption over its lower third: open roles first (that is what an
 * actor or crew member scans for), then the title, logline, dates, place and
 * pay, then who posted it. Swipe right to apply, left to pass.
 */

function Poster({ post, dim }: { post: PostWithCreator; dim?: boolean }) {
  const uri = post.media_urls?.[0];
  return (
    <View style={[StyleSheet.absoluteFill, dim && { opacity: 0.7 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <View style={styles.placeholder}>
          <Clapperboard size={56} color={colors.textFaint} strokeWidth={1.2} />
          <Text style={styles.placeholderText}>No poster yet</Text>
        </View>
      )}
      {/* Scrim: three stacked bands fade the poster into the caption. */}
      <View pointerEvents="none" style={[styles.scrimBand, { bottom: 0, height: "62%", opacity: 0.35 }]} />
      <View pointerEvents="none" style={[styles.scrimBand, { bottom: 0, height: "46%", opacity: 0.5 }]} />
      <View pointerEvents="none" style={[styles.scrimBand, { bottom: 0, height: "30%", opacity: 0.7 }]} />
    </View>
  );
}

function Caption({ post }: { post: PostWithCreator }) {
  const roles = shootRoles(post);
  const dates = shootDates(post);
  const pay = payLabel(post);
  const shown = roles.slice(0, 3);
  const extra = roles.length - shown.length;

  return (
    <View style={styles.captionWrap}>
      <BlurView intensity={glass.intensityStrong} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,11,16,0.55)" }]} />
      <View pointerEvents="none" style={styles.captionEdge} />
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
              <CalendarDays size={13} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{dates}</Text>
            </View>
          ) : null}
          {post.location ? (
            <View style={styles.meta}>
              <MapPin size={13} color={colors.textMuted} />
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
          style={styles.infoBtn}
          hitSlop={10}
          accessibilityLabel="Shoot details"
        >
          <BlurView intensity={glass.intensity} tint="dark" style={StyleSheet.absoluteFill} />
          <Info size={16} color={colors.text} />
        </Pressable>

        <Animated.View style={[styles.stamp, styles.stampApply, applyOverlay]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.accent }]}>APPLY</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampPass, passOverlay]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.text }]}>PASS</Text>
        </Animated.View>

        <Caption post={post} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii.xxl,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    ...shadows.lift,
  },
  behindCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.bgElevated,
  },
  placeholderText: { ...typography.tiny, color: colors.textFaint },
  scrimBand: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
  },
  infoBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stamp: {
    position: "absolute",
    top: 22,
    borderWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  stampApply: { left: 20, borderColor: colors.accent, transform: [{ rotate: "-12deg" }] },
  stampPass: { right: 20, borderColor: colors.text, transform: [{ rotate: "12deg" }] },
  stampText: { fontWeight: "900", fontSize: 24, letterSpacing: 3 },
  captionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  captionEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.highlight,
  },
  caption: {
    padding: 18,
    paddingBottom: 20,
    gap: 8,
  },
  title: {
    ...typography.h1,
    marginTop: 2,
  },
  logline: {
    ...typography.small,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "60%" },
  metaText: { ...typography.small, color: colors.textMuted },
  byRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  byText: { ...typography.small, flex: 1 },
  byName: { color: colors.text, fontWeight: "700" },
});
