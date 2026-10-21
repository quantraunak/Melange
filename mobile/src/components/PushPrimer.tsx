import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, X } from "lucide-react-native";

import { colors, fonts, spacing, typography } from "@/lib/theme";
import { getPushPermission, registerForPushAsync } from "@/lib/push";

/**
 * Asks for notifications at a moment that makes the case for them.
 *
 * The app used to raise the iOS notification dialog on first load of the tab
 * bar — before the person had a match, a message, or any reason to want to be
 * interrupted. iOS only allows that dialog once, so a "Don't Allow" there is
 * permanent, and it takes match and message notifications with it for good.
 * This asks first; only pressing "Turn on" raises the system dialog, and
 * dismissing is remembered so nobody gets nagged.
 *
 * It is a one-line banner rather than a card. It used to be a hero block with
 * an icon tile, a title, three lines of body and a filled blue pill, sitting
 * above a list of one conversation — louder than the content it interrupted,
 * and the only saturated colour on the screen.
 */

const DISMISSED_KEY = "melange.push-primer-dismissed";

export function PushPrimer({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [permission, dismissed] = await Promise.all([
        getPushPermission(),
        AsyncStorage.getItem(DISMISSED_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setShow(permission === "undetermined" && dismissed !== "1");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    await registerForPushAsync(userId, { prompt: true });
    setBusy(false);
    // Either they allowed it, or they didn't and iOS won't ask again —
    // either way this card has done its job and shouldn't come back.
    setShow(false);
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
  }, [userId]);

  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <View style={styles.bar}>
      <Bell size={15} color={colors.textSecondary} />
      {/* One line, five words: it sits above people's conversations and
          should never be the loudest thing there. */}
      <Text style={styles.text} numberOfLines={1}>
        Know when someone writes.
      </Text>
      <Pressable onPress={enable} disabled={busy} hitSlop={10}>
        <Text style={styles.action}>{busy ? "…" : "Turn on"}</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
        <X size={15} color={colors.iconFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: spacing.xs,
  },
  text: { ...typography.caption, flex: 1, color: colors.textSecondary },
  action: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
});
