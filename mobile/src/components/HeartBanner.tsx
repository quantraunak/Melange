import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Heart, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radii, shadows, spacing, typography } from "@/lib/theme";

type Shown = { userId: string; name: string; avatar_url: string | null; what: string };

/**
 * "Jolea hearted you ✨  Message Jolea!" across the top of the app the moment
 * someone hearts you. Before this a heart was a line in the corner of
 * Messages, easy to miss. Push covers the app being closed; this covers it
 * being open (push.ts keeps the system banner from saying it twice).
 */
export function HeartBanner() {
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<Shown | null>(null);
  const [slide] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`hearts-to:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hearts", filter: `to_user=eq.${userId}` },
        async (payload) => {
          const h = payload.new as { from_user: string; kind: string };
          if (!h.from_user || h.from_user === userId) return;
          const { data } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("user_id", h.from_user)
            .maybeSingle();
          const name = (data?.name as string | undefined)?.trim() || "Someone";
          setShown({
            userId: h.from_user,
            name,
            avatar_url: (data?.avatar_url as string | null) ?? null,
            what: h.kind === "story" ? "your work" : "you",
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!shown) return;
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => hide(), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const hide = () => {
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShown(null));
  };

  if (!shown) return null;
  const first = shown.name.split(" ")[0];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + spacing.sm },
        { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}
    >
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Pressable
          style={styles.main}
          onPress={() => {
            hide();
            router.push({ pathname: "/profile/[userId]", params: { userId: shown.userId } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${shown.name} hearted ${shown.what}. Open their profile.`}
        >
          <Avatar creator={{ name: shown.name, avatar_url: shown.avatar_url }} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {first} hearted {shown.what} ✨
            </Text>
            <Text style={styles.body} numberOfLines={1}>
              Message {first}!
            </Text>
          </View>
          <Heart size={16} color={colors.brand} fill={colors.brand} />
        </Pressable>
        <Pressable
          style={styles.msg}
          onPress={() => {
            hide();
            router.push({ pathname: "/message/[userId]", params: { userId: shown.userId } });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.msgText}>Message</Text>
        </Pressable>
        <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Dismiss">
          <X size={16} color={colors.iconFaint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadows.float,
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textSecondary },
  msg: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  msgText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.onBrand },
});
