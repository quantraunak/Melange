import { useEffect, useState } from "react";
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
import { CalendarDays, ChevronRight, MapPin, Sparkles } from "lucide-react-native";

import { colors, glass as glassTokens, radii, shadows, typography } from "@/lib/theme";
import { payLabel, projectDates, projectRoles, type PostWithCreator } from "@/lib/db";
import { Avatar } from "./Avatar";
import { Chip, ChipRow } from "./ui/Chip";
import { Fade } from "./ui/Fade";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const ROTATION_MAX = 10; // degrees

export type SwipeDir = "left" | "right";

/**
 * The project card, full bleed.
 *
 * One photo filling the screen, with everything else floating on top of it:
 * a light frosted panel at the bottom carrying the collab, and the Like and
 * Pass buttons as glass circles over the image rather than a bar beneath it.
 * The photo is the content; the chrome gets out of its way.
 *
 * Projects with more than one image page like a story viewer: tap the left or
 * right third, segments across the top show where you are.
 */

function Poster({
  post,
  imageIndex,
  dim,
}: {
  post: PostWithCreator;
  imageIndex: number;
  dim?: boolean;
}) {
  const urls = post.media_urls ?? [];
  const uri = urls[Math.min(imageIndex, Math.max(0, urls.length - 1))];
  return (
    <View style={[StyleSheet.absoluteFill, dim ? { opacity: 0.7 } : null]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.placeholder}>
          <Sparkles size={64} color={colors.textFaint} strokeWidth={1.1} />
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}
    </View>
  );
}

/** Instagram-style segments, one per image. Hidden for a single image. */
function Segments({ count, index, topInset }: { count: number; index: number; topInset: number }) {
  if (count < 2) return null;
  return (
    <View style={[styles.segments, { top: topInset + 10 }]} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.segment, i === index && styles.segmentOn]} />
      ))}
    </View>
  );
}

/**
 * The frosted panel. Light tint, white at ~78%, with a hairline highlight on
 * its top edge so it reads as a pane of glass sitting on the photo rather
 * than a block of fog.
 */
function GlassPanel({
  post,
  onPress,
  bottomInset,
}: {
  post: PostWithCreator;
  onPress: () => void;
  bottomInset: number;
}) {
  const roles = projectRoles(post);
  const dates = projectDates(post);
  const pay = payLabel(post);
  const shown = roles.slice(0, 3);
  const extra = roles.length - shown.length;

  return (
    <View style={[styles.panelWrap, { bottom: bottomInset }]}>
      <Fade height={110} style={styles.panelFade} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${post.title}. Open project details.`}
        style={({ pressed }) => [styles.panelPress, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.panelClip}>
          <BlurView
            intensity={glassTokens.intensityStrong}
            tint={glassTokens.tint}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.panelTintLayer} pointerEvents="none" />
          <View style={styles.panelHighlight} pointerEvents="none" />

          <View style={styles.panel}>
            {roles.length ? (
              <ChipRow>
                {shown.map((r) => (
                  <Chip key={r} label={r} size="sm" tone="accent" />
                ))}
                {extra > 0 ? <Chip label={`+${extra}`} size="sm" tone="outline" /> : null}
              </ChipRow>
            ) : null}

            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {post.title}
              </Text>
              <ChevronRight size={20} color={colors.textSubtle} />
            </View>

            {post.description ? (
              <Text style={styles.logline} numberOfLines={2}>
                {post.description}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              {dates ? (
                <View style={styles.meta}>
                  <CalendarDays size={14} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {dates}
                  </Text>
                </View>
              ) : null}
              {post.location ? (
                <View style={styles.meta}>
                  <MapPin size={14} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {post.location}
                  </Text>
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
      </Pressable>
    </View>
  );
}

/** The next card, peeking behind for depth. Non-interactive. */
export function SwipeCardBehind({
  post,
  topInset,
  bottomInset,
}: {
  post: PostWithCreator;
  topInset: number;
  bottomInset: number;
}) {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 200 });
    opacity.value = withTiming(0.8, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.card, styles.behindCard, animatedStyle]} pointerEvents="none">
      <Poster post={post} imageIndex={0} dim />
      <GlassPanel post={post} onPress={() => {}} bottomInset={bottomInset} />
      <View style={{ height: topInset }} />
    </Animated.View>
  );
}

type Props = {
  post: PostWithCreator;
  onSwipe: (dir: SwipeDir) => void;
  onOpenDetails: () => void;
  disabled?: boolean;
  topInset: number;
  bottomInset: number;
  /** Bumped by the parent to drive a swipe from the Like/Pass buttons. */
  pendingButtonSwipe: SwipeDir | null;
  onButtonSwipeComplete: () => void;
};

export function SwipeCard({
  post,
  onSwipe,
  onOpenDetails,
  disabled,
  topInset,
  bottomInset,
  pendingButtonSwipe,
  onButtonSwipeComplete,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const entrance = useSharedValue(0);
  const [imageIndex, setImageIndex] = useState(0);

  const images = post.media_urls?.length ?? 0;

  const triggerSwipe = (dir: SwipeDir) => {
    Haptics.impactAsync(
      dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onSwipe(dir);
  };

  useEffect(() => {
    entrance.value = 0;
    entrance.value = withSpring(1, { damping: 20, stiffness: 260 });
    setImageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  useEffect(() => {
    if (!pendingButtonSwipe) return;
    const target = pendingButtonSwipe === "right" ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
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
    // Let a tap through to the paging zones and the panel; only treat it as a
    // drag once the finger has actually travelled.
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const vx = e.velocityX;
      const wentRight = dx > SWIPE_THRESHOLD || vx > 800;
      const wentLeft = dx < -SWIPE_THRESHOLD || vx < -800;

      if (wentRight) {
        tx.value = withTiming(SCREEN_W * 1.5, { duration: 220 }, (done) => {
          if (done) runOnJS(triggerSwipe)("right");
        });
      } else if (wentLeft) {
        tx.value = withTiming(-SCREEN_W * 1.5, { duration: 220 }, (done) => {
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
        { translateY: ty.value + (1 - entrance.value) * 14 },
        { scale: 0.97 + entrance.value * 0.03 },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOverlay = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, tx.value / SWIPE_THRESHOLD)),
  }));
  const passOverlay = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, -tx.value / SWIPE_THRESHOLD)),
  }));

  const page = (dir: -1 | 1) => {
    if (images < 2) return;
    setImageIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= images) return i;
      Haptics.selectionAsync();
      return next;
    });
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Poster post={post} imageIndex={imageIndex} />

        {/* Paging zones sit under the panel and above the photo. */}
        {images > 1 ? (
          <View style={styles.pagingRow} pointerEvents="box-none">
            <Pressable
              style={styles.pageZone}
              onPress={() => page(-1)}
              accessibilityLabel="Previous photo"
            />
            <View style={styles.pageZoneSpacer} pointerEvents="none" />
            <Pressable
              style={styles.pageZone}
              onPress={() => page(1)}
              accessibilityLabel="Next photo"
            />
          </View>
        ) : null}

        <Segments count={images} index={imageIndex} topInset={topInset} />

        <Animated.View
          style={[styles.stamp, styles.stampLike, { top: topInset + 44 }, likeOverlay]}
          pointerEvents="none"
        >
          <Text style={[styles.stampText, { color: colors.like }]}>LIKE</Text>
        </Animated.View>
        <Animated.View
          style={[styles.stamp, styles.stampPass, { top: topInset + 44 }, passOverlay]}
          pointerEvents="none"
        >
          <Text style={[styles.stampText, { color: colors.passText }]}>PASS</Text>
        </Animated.View>

        <GlassPanel post={post} onPress={onOpenDetails} bottomInset={bottomInset} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.surfaceStrong,
  },
  behindCard: {},
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surfaceStrong,
  },
  placeholderText: { ...typography.small, color: colors.textSubtle },

  pagingRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  pageZone: { width: "32%", height: "100%" },
  pageZoneSpacer: { flex: 1 },

  segments: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  segmentOn: { backgroundColor: colors.white },

  stamp: {
    position: "absolute",
    borderWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  stampLike: { left: 22, borderColor: colors.like, transform: [{ rotate: "-12deg" }] },
  stampPass: { right: 22, borderColor: colors.passText, transform: [{ rotate: "12deg" }] },
  stampText: { fontWeight: "900", fontSize: 26, letterSpacing: 3 },

  panelWrap: { position: "absolute", left: 0, right: 0 },
  panelFade: { position: "absolute", left: 0, right: 0, bottom: "100%" },
  panelPress: { paddingHorizontal: 10 },
  panelClip: {
    borderRadius: radii.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    ...shadows.soft,
  },
  panelTintLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  panelHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  panel: { padding: 16, paddingTop: 14, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...typography.h1, flex: 1 },
  logline: { ...typography.small, color: colors.textMuted },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "60%" },
  metaText: { ...typography.small, color: colors.textMuted },
  byRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  byText: { ...typography.small, flex: 1 },
  byName: { color: colors.text, fontWeight: "700" },
});
