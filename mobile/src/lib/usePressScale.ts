import { useCallback } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { motion } from "./theme";

type Kind = keyof typeof motion.press;

/**
 * The one press interaction in the app.
 *
 * `Pressable`'s own style callback applies on the touch frame and reverts on
 * lift, which is a jolt rather than a press — and at the scales previously in
 * use (0.995 on a 408pt card is 1.8pt of travel) it was below the perceptual
 * floor anyway. This drives a Reanimated value instead: a quick timed press
 * down, a spring back up.
 *
 * Haptics fire on press *in*. A buzz on press-out arrives after the decision
 * has already been made and reads as lag.
 */
export function usePressScale(kind: Kind = "wide", opts?: { haptic?: boolean }) {
  const scale = useSharedValue(1);
  const haptic = opts?.haptic ?? true;

  const onPressIn = useCallback(() => {
    scale.value = withTiming(motion.press[kind], {
      duration: motion.durations.instant,
      easing: motion.easings.standard,
    });
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [scale, kind, haptic]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.springs.press);
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { onPressIn, onPressOut, style, scale };
}
