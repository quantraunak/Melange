import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, X } from "lucide-react-native";

import { colors, radii } from "@/lib/theme";
import { getPushPermission, registerForPushAsync } from "@/lib/push";

/**
 * Asks for notifications at a moment that makes the case for them.
 *
 * The app used to raise the iOS notification dialog on first load of the tab
 * bar — before the person had a match, a message, or any reason to want to be
 * interrupted. iOS only allows that dialog once, so a "Don't Allow" there is
 * permanent, and it takes match and message notifications with it for good.
 *
 * This card explains what the notifications are before the system dialog can
 * appear; only pressing "Turn on" raises it. Dismissing is remembered, so
 * nobody gets nagged.
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
    <View style={styles.card}>
      <View style={styles.icon}>
        <Bell size={17} color={colors.brandText} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Know when someone matches you</Text>
        <Text style={styles.text}>
          Shoots get planned in the first few hours. Turn on notifications and we&apos;ll tell you
          about new matches and messages — nothing else.
        </Text>
        <Pressable onPress={enable} disabled={busy} style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? "Just a sec…" : "Turn on notifications"}</Text>
        </Pressable>
      </View>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.close} accessibilityLabel="Dismiss">
        <X size={15} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    paddingRight: 30,
    backgroundColor: colors.brandSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontWeight: "800", color: colors.brand },
  text: { fontSize: 12, color: colors.brandText, lineHeight: 17, opacity: 0.9 },
  cta: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  ctaText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  close: { position: "absolute", top: 10, right: 10 },
});
