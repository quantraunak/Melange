import { useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarDays, Heart, Image as ImageIcon, MapPin, X } from "lucide-react-native";

import { colors, GUTTER, motion, radii, shadows, typography } from "@/lib/theme";
import { payLabel, projectDates, projectRoles, type PostWithCreator } from "@/lib/db";
import { sized } from "@/lib/imageUrl";
import { usePressScale } from "@/lib/usePressScale";
import { Avatar } from "./Avatar";
import { Chip, ChipRow } from "./ui/Chip";
import { Scrim } from "./ui/Scrim";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const ROTATION_MAX = 5; // degrees
/** Pivot below the screen, so the card hinges like held paper instead of spinning like a dial. */
const PIVOT = SCREEN_H * 1.15;

export type SwipeDir = "left" | "right";

/**
 * The project card: one photograph, full bleed, with the plate below it.
 *
 * The plate is the app's one structural idea. It is an opaque white surface
 * running edge to edge, square at the bottom and rounded at the top, carrying
 * the caption *and* the two verbs. It states a rule the rest of the app
 * follows: content is opaque and goes edge to edge; chrome floats inset and
 * is the only thing made of glass. Nothing washes over the photograph, so it
 * keeps its full density and chroma right down to the plate's top edge.
 */

function Poster({
  post,
  imageIndex,
  height,
}: {
  post: PostWithCreator;
  imageIndex: number;
  /** Frame height in points, so we can request the pixels we will actually draw. */
  height: number;
}) {
  const urls = post.media_urls ?? [];
  const raw = urls[Math.min(imageIndex, Math.max(0, urls.length - 1))];
  // Overscan is part of the drawn area, so it is part of what we ask for.
  const uri = sized(raw, SCREEN_W + 48, height + 48);
  return (
    // Slight overscan so rotation cannot expose the ground at the corners.
    // 24pt, not 88: at 5 degrees about a pivot below the screen the worst-case
    // corner lift is about 19pt, and every extra point upscales the source
    // past its native width, which visibly softens the photograph.
    <View style={styles.poster}>
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
          <ImageIcon size={56} color={colors.iconFaint} strokeWidth={1.75} />
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}
    </View>
  );
}

/** One segment per image. Given its own band so the floating controls cannot cover it. */
function Segments({ count, index, topInset }: { count: number; index: number; topInset: number }) {
  if (count < 2) return null;
  return (
    <View style={[styles.segments, { top: topInset + 8 }]} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.segment, i === index && styles.segmentOn]} />
      ))}
    </View>
  );
}

/**
 * The plate. Opaque white, edge to edge, carrying the caption and the verbs.
 */
function Plate({
  post,
  onPress,
  onPressCreator,
  bottom,
  onPass,
  onLike,
  onUndo,
  canUndo,
  busy,
}: {
  post: PostWithCreator;
  onPress: () => void;
  onPressCreator?: () => void;
  bottom: number;
  onPass?: () => void;
  onLike?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  busy?: boolean;
}) {
  const roles = projectRoles(post);
  const dates = projectDates(post);
  const pay = payLabel(post);
  const shown = roles.slice(0, 3);
  const extra = roles.length - shown.length;
  const press = usePressScale("card", { haptic: false });
  const interactive = !!onLike;

  return (
    <View style={[styles.plateWrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.plateShadow}>
        <View style={styles.plateClip}>
          <Animated.View style={interactive ? press.style : undefined}>
            <Pressable
              onPress={onPress}
              onPressIn={interactive ? press.onPressIn : undefined}
              onPressOut={interactive ? press.onPressOut : undefined}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${post.title}. Open project details.`}
              style={styles.caption}
            >
              {roles.length ? (
                <ChipRow style={styles.chips}>
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
                    <CalendarDays size={14} color={colors.iconFaint} strokeWidth={1.75} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {dates}
                    </Text>
                  </View>
                ) : null}
                {post.location ? (
                  <View style={styles.meta}>
                    <MapPin size={14} color={colors.iconFaint} strokeWidth={1.75} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {post.location}
                    </Text>
                  </View>
                ) : null}
                {pay ? <Chip label={pay} size="sm" /> : null}
              </View>

              {/* Nested inside the plate's own press target on purpose: the
                  caption opens the project, the byline opens the person. */}
              <Pressable
                onPress={onPressCreator}
                disabled={!onPressCreator}
                hitSlop={8}
                accessibilityRole={onPressCreator ? "button" : undefined}
                accessibilityLabel={onPressCreator ? `${post.creator.name}'s profile` : undefined}
                style={({ pressed }) => [styles.byRow, pressed && onPressCreator && { opacity: 0.6 }]}
              >
                <Avatar creator={post.creator} size="sm" />
                <Text style={styles.byText} numberOfLines={1}>
                  <Text style={styles.byName}>{post.creator.name}</Text>
                  {post.creator.verification_status === "verified" ? " ✓" : ""}
                  {post.creator.role ? `  ·  ${post.creator.role}` : ""}
                </Text>
              </Pressable>
            </Pressable>
          </Animated.View>

          {interactive ? (
            <View style={styles.verbs}>
              {canUndo ? (
                <Pressable
                  onPress={onUndo}
                  disabled={busy}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Undo last swipe"
                  style={styles.undo}
                >
                  <UndoGlyph />
                </Pressable>
              ) : null}

              <VerbButton
                label="Pass"
                onPress={onPass}
                disabled={busy}
                tone="plain"
                glyph={<X size={28} color={colors.text} strokeWidth={2} />}
              />
              <VerbButton
                label="Like"
                onPress={onLike}
                disabled={busy}
                tone="accent"
                glyph={<Heart size={28} color={colors.onAccent} fill={colors.onAccent} />}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function UndoGlyph() {
  return (
    <View style={styles.undoInner}>
      <Text style={styles.undoText}>Undo</Text>
    </View>
  );
}

function VerbButton({
  label,
  glyph,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  glyph: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone: "plain" | "accent";
}) {
  const press = usePressScale("circle");
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={[styles.verb, tone === "accent" ? styles.verbAccent : styles.verbPlain]}
      >
        {glyph}
      </Pressable>
    </Animated.View>
  );
}

/**
 * The next card, visible behind the top one.
 *
 * Driven by the front card's drag rather than a mount effect: it used to
 * spring 0.97 → 0.97 forever because the component was never remounted, so
 * the deck had no depth cue at all.
 */
export function SwipeCardBehind({
  post,
  tx,
  barTop,
}: {
  post: PostWithCreator;
  tx: SharedValue<number>;
  /** Distance from the bottom of the screen to the top of the tab bar. */
  barTop: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(tx.value) / SWIPE_THRESHOLD);
    return {
      opacity: 0.82 + p * 0.18,
      transform: [{ scale: 0.94 + p * 0.06 }],
    };
  });

  return (
    <Animated.View style={[styles.card, { bottom: barTop }, animatedStyle]} pointerEvents="none">
      <Poster post={post} imageIndex={0} height={SCREEN_H - barTop} />
      <Plate post={post} onPress={() => {}} bottom={0} />
    </Animated.View>
  );
}

type Props = {
  post: PostWithCreator;
  onSwipe: (dir: SwipeDir) => void;
  onOpenDetails: () => void;
  /** The byline opens the person behind the project. */
  onOpenCreator?: () => void;
  disabled?: boolean;
  topInset: number;
  /** Distance from the bottom of the screen to the top of the tab bar. */
  barTop: number;
  tx: SharedValue<number>;
  onPass: () => void;
  onLike: () => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Set by the parent to drive a swipe from the Like/Pass buttons. */
  pendingButtonSwipe: SwipeDir | null;
  onButtonSwipeComplete: () => void;
};

export function SwipeCard({
  post,
  onSwipe,
  onOpenDetails,
  onOpenCreator,
  disabled,
  topInset,
  barTop,
  tx,
  onPass,
  onLike,
  onUndo,
  canUndo,
  pendingButtonSwipe,
  onButtonSwipeComplete,
}: Props) {
  const ty = useSharedValue(0);
  const entrance = useSharedValue(0);
  const crossed = useSharedValue(0);
  const [imageIndex, setImageIndex] = useState(0);

  const images = post.media_urls?.length ?? 0;

  /**
   * The single place a swipe is committed. It runs the moment the gesture
   * ends, not from an animation completion callback — a haptic that arrives
   * 240ms late reads as lag, and a callback guarded by `if (done)` silently
   * dropped the swipe whenever the user touched the screen mid-flight.
   */
  const triggerSwipe = (dir: SwipeDir) => {
    Haptics.impactAsync(
      dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Rigid
    ).catch(() => {});
    onSwipe(dir);
  };

  useEffect(() => {
    entrance.value = 0;
    entrance.value = withSpring(1, motion.springs.promote);
    crossed.value = 0;
    setImageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  useEffect(() => {
    if (!pendingButtonSwipe) return;
    const dir = pendingButtonSwipe;
    // Clear immediately: holding this until an animation callback is what let
    // a mid-flight touch leave it set forever, killing both buttons.
    onButtonSwipeComplete();
    triggerSwipe(dir);
    const target = dir === "right" ? SCREEN_W * 1.25 : -SCREEN_W * 1.25;
    tx.value = withTiming(target, { duration: 240, easing: motion.easings.exit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingButtonSwipe]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.35;
      // One-shot cue the moment the drag passes the commit point.
      if (Math.abs(e.translationX) >= SWIPE_THRESHOLD && crossed.value === 0) {
        crossed.value = 1;
        runOnJS(Haptics.selectionAsync)();
      } else if (Math.abs(e.translationX) < SWIPE_THRESHOLD) {
        crossed.value = 0;
      }
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const wentRight = dx > SWIPE_THRESHOLD || e.velocityX > 800;
      const wentLeft = dx < -SWIPE_THRESHOLD || e.velocityX < -800;

      if (wentRight || wentLeft) {
        const dir: SwipeDir = wentRight ? "right" : "left";
        runOnJS(triggerSwipe)(dir);

        // Duration tracks the throw: a hard flick leaves fast, a nudge drifts.
        const vx = Math.max(Math.abs(e.velocityX), 900);
        const remaining = SCREEN_W * 1.25 - Math.abs(dx);
        const dur = Math.max(130, Math.min(300, (remaining / vx) * 1000));
        const target = wentRight ? SCREEN_W * 1.25 : -SCREEN_W * 1.25;

        tx.value = withTiming(target, { duration: dur, easing: motion.easings.exit });
        ty.value = withTiming(ty.value + e.velocityY * 0.1, {
          duration: dur,
          easing: motion.easings.exit,
        });
      } else {
        tx.value = withSpring(0, motion.springs.snap);
        ty.value = withSpring(0, motion.springs.snap);
      }
    })
    // Without this an interrupted gesture parks the card off-centre forever.
    .onFinalize(() => {
      if (Math.abs(tx.value) < SWIPE_THRESHOLD) {
        tx.value = withSpring(0, motion.springs.snap);
        ty.value = withSpring(0, motion.springs.snap);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = (tx.value / SCREEN_W) * ROTATION_MAX;
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { translateY: PIVOT },
        { rotate: `${rotate}deg` },
        { translateY: -PIVOT },
        { scale: 0.96 + entrance.value * 0.04 },
      ],
    };
  });

  /** A tint plus one glyph, quiet through the first third of the drag. */
  const likeOverlay = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, tx.value / SWIPE_THRESHOLD));
    const p = raw * raw * (3 - 2 * raw);
    return { opacity: p };
  });
  const passOverlay = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, -tx.value / SWIPE_THRESHOLD));
    const p = raw * raw * (3 - 2 * raw);
    return { opacity: p };
  });
  const likeGlyph = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, tx.value / SWIPE_THRESHOLD));
    const p = raw * raw * (3 - 2 * raw);
    return { opacity: p, transform: [{ scale: 0.82 + p * 0.18 }] };
  });
  const passGlyph = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, -tx.value / SWIPE_THRESHOLD));
    const p = raw * raw * (3 - 2 * raw);
    return { opacity: p, transform: [{ scale: 0.82 + p * 0.18 }] };
  });

  const page = (dir: -1 | 1) => {
    if (images < 2 || disabled) return;
    setImageIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= images) return i;
      Haptics.selectionAsync().catch(() => {});
      return next;
    });
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { bottom: barTop }, animatedStyle]}>
        <Poster post={post} imageIndex={imageIndex} height={SCREEN_H - barTop} />

        {/* The only gradient in the app: keeps the dark status bar legible. */}
        <Scrim height={topInset + 48} />

        {images > 1 ? (
          <View style={styles.pagingRow} pointerEvents="box-none">
            <Pressable
              style={styles.pageZone}
              onPress={() => page(-1)}
              disabled={disabled}
              accessibilityLabel="Previous photo"
            />
            <View style={styles.pageZoneSpacer} pointerEvents="none" />
            <Pressable
              style={styles.pageZone}
              onPress={() => page(1)}
              disabled={disabled}
              accessibilityLabel="Next photo"
            />
          </View>
        ) : null}

        <Segments count={images} index={imageIndex} topInset={topInset} />

        <Animated.View style={[styles.tint, styles.tintLike, likeOverlay]} pointerEvents="none" />
        <Animated.View style={[styles.tint, styles.tintPass, passOverlay]} pointerEvents="none" />
        <Animated.View style={[styles.verdict, likeGlyph]} pointerEvents="none">
          <View style={styles.verdictRing}>
            <Heart size={88} color={colors.white} strokeWidth={2.25} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.verdict, passGlyph]} pointerEvents="none">
          <View style={styles.verdictRing}>
            <X size={88} color={colors.white} strokeWidth={2.25} />
          </View>
        </Animated.View>

        <Plate
          post={post}
          onPress={onOpenDetails}
          onPressCreator={onOpenCreator}
          bottom={0}
          onPass={onPass}
          onLike={onLike}
          onUndo={onUndo}
          canUndo={canUndo}
          busy={disabled}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  poster: { ...StyleSheet.absoluteFillObject, margin: -24 },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.bg,
  },
  placeholderText: { ...typography.caption, color: colors.textTertiary },

  pagingRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  pageZone: { width: "32%", height: "100%" },
  pageZoneSpacer: { flex: 1 },

  segments: {
    position: "absolute",
    left: GUTTER,
    right: GUTTER,
    flexDirection: "row",
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: "rgba(255,255,255,0.50)",
    // Deliberately off-scale, like the 1.25 radius above. The three elevation
    // tokens are sized for surfaces; on a 2.5pt track any of them is a smear.
    // This exists only so the dots survive a white sky behind them.
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentOn: { backgroundColor: colors.white },

  tint: { ...StyleSheet.absoluteFillObject },
  tintLike: { backgroundColor: "rgba(124,58,237,0.18)" },
  tintPass: { backgroundColor: "rgba(17,24,39,0.22)" },
  verdict: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  verdictRing: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.90)",
  },

  // The plate: opaque, edge to edge, square at the bottom.
  plateWrap: { position: "absolute", left: 0, right: 0 },
  plateShadow: { ...shadows.plate },
  plateClip: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  caption: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: GUTTER },
  chips: { marginBottom: 12 },
  title: { ...typography.display2, marginBottom: 6 },
  logline: { ...typography.body, color: colors.textSecondary, marginBottom: 14 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "60%" },
  metaText: { ...typography.caption },
  byRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  byText: { ...typography.caption, flex: 1 },
  byName: { ...typography.bodyStrong },

  verbs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  verb: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  verbPlain: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  verbAccent: { backgroundColor: colors.accent, ...shadows.card },
  // Absolute, so Pass and Like centre on the screen's spine rather than on
  // the bounding box of all three controls.
  undo: { position: "absolute", left: GUTTER, height: 44, justifyContent: "center" },
  undoInner: { paddingHorizontal: 4 },
  undoText: { ...typography.caption, fontFamily: "Inter_600SemiBold", color: colors.text },
});
