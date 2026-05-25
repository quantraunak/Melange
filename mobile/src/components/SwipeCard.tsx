import { useEffect } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { DollarSign, Info, MapPin, Users } from "lucide-react-native";

import { colors, radii, shadows } from "@/lib/theme";
import type { PostWithCreator } from "@/lib/db";
import { Avatar } from "./Avatar";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const ROTATION_MAX = 14; // degrees

export type SwipeDir = "left" | "right";

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

  const triggerSwipe = (dir: SwipeDir) => {
    Haptics.impactAsync(
      dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onSwipe(dir);
  };

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
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
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

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.imageWrap}>
          {post.media_urls?.[0] ? (
            <Image
              source={{ uri: post.media_urls[0] }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderEmoji}>🎨</Text>
            </View>
          )}

          <Pressable onPress={onOpenDetails} style={styles.infoBtn} hitSlop={10}>
            <Info size={16} color={colors.brandText} />
          </Pressable>

          <Animated.View style={[styles.stampLike, likeOverlay]} pointerEvents="none">
            <Text style={styles.stampLikeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stampPass, passOverlay]} pointerEvents="none">
            <Text style={styles.stampPassText}>PASS</Text>
          </Animated.View>
        </View>

        <View style={styles.body}>
          <View style={styles.creatorRow}>
            <Avatar creator={post.creator} size="md" />
            <View style={styles.creatorText}>
              <Text style={styles.creatorName} numberOfLines={1}>
                {post.creator.name}
                {post.creator.verification_status === "verified" ? (
                  <Text style={styles.verified}> ✓</Text>
                ) : null}
              </Text>
              {post.creator.role ? (
                <Text style={styles.creatorRole} numberOfLines={1}>
                  {post.creator.role}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          {post.description ? (
            <Text style={styles.description} numberOfLines={3}>
              {post.description}
            </Text>
          ) : null}

          <View style={styles.metaList}>
            {post.location ? (
              <MetaRow icon={<MapPin size={12} color={colors.textSubtle} />} text={post.location} />
            ) : null}
            {post.looking_for?.length ? (
              <MetaRow
                icon={<Users size={12} color={colors.textSubtle} />}
                text={`Looking for: ${post.looking_for.join(", ")}`}
              />
            ) : null}
            {post.compensation ? (
              <MetaRow
                icon={<DollarSign size={12} color={colors.textSubtle} />}
                text={post.compensation}
              />
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.metaRow}>
      {icon}
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    overflow: "hidden",
    ...shadows.card,
  },
  imageWrap: {
    height: 240,
    width: "100%",
    backgroundColor: "#dbeafe",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 64,
    opacity: 0.25,
  },
  infoBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stampLike: {
    position: "absolute",
    top: 20,
    left: 20,
    borderColor: colors.like,
    borderWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: "-12deg" }],
  },
  stampLikeText: {
    color: colors.like,
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: 2,
  },
  stampPass: {
    position: "absolute",
    top: 20,
    right: 20,
    borderColor: colors.danger,
    borderWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: "12deg" }],
  },
  stampPassText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: 2,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  creatorText: {
    flex: 1,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  verified: {
    color: colors.brandText,
    fontWeight: "800",
  },
  creatorRole: {
    fontSize: 12,
    color: colors.textMuted,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metaList: {
    gap: 4,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSubtle,
    flex: 1,
  },
});
