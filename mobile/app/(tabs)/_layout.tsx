import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  Clapperboard,
  Compass,
  MessageCircle,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { BrandHeader } from "@/components/BrandHeader";
import { Backdrop } from "@/components/ui/Backdrop";
import { Glass } from "@/components/ui/Glass";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { registerForPushAsync } from "@/lib/push";
import { colors, radii } from "@/lib/theme";

function PushBootstrap() {
  const { userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    // prompt:false — this re-registers the token for someone who has already
    // said yes, and stays silent otherwise. The ask itself belongs to
    // PushPrimer, where there's room to explain it first.
    registerForPushAsync(userId, { prompt: false }).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { kind?: string; matchId?: string }
        | undefined;
      if (data?.matchId) {
        router.push({ pathname: "/chat/[matchId]", params: { matchId: data.matchId } });
      }
    });
    return () => sub.remove();
  }, [userId, router]);

  return null;
}

function Header() {
  const router = useRouter();
  return (
    <BrandHeader
      right={
        <Pressable
          hitSlop={12}
          onPress={() => router.push("/account/settings")}
          accessibilityLabel="Settings"
          style={styles.settingsBtn}
        >
          <SettingsIcon size={18} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
}

const TAB_ICONS: Record<string, (p: { color: string; size: number }) => React.ReactNode> = {
  connect: (p) => <Clapperboard {...p} />,
  events: (p) => <Compass {...p} />,
  messages: (p) => <MessageCircle {...p} />,
  profile: (p) => <UserRound {...p} />,
};

const TAB_BAR_PAD = 6;

/**
 * Floating glass tab bar. The active tab is a lighter pill that springs to
 * its position; icons carry the meaning and the label sits under them so the
 * bar reads at a glance over any poster behind it.
 */
function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { unreadCount } = useMatches();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const pillWidth = barWidth > 0 ? (barWidth - TAB_BAR_PAD * 2) / tabCount : 0;
  const tx = useSharedValue(0);

  useEffect(() => {
    if (pillWidth <= 0) return;
    tx.value = withSpring(TAB_BAR_PAD + state.index * pillWidth, {
      damping: 20,
      stiffness: 220,
    });
  }, [state.index, pillWidth, tx]);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass variant="strong" radius={radii.xxl} elevated style={styles.tabBarGlass}>
        <View style={styles.tabBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {pillWidth > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}
          {state.routes.map((route, idx) => {
            const focused = state.index === idx;
            const { options } = descriptors[route.key];
            const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
            const badge = route.name === "messages" ? unreadCount : 0;
            const color = focused ? colors.text : colors.textSubtle;

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                Haptics.selectionAsync();
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                style={styles.tab}
              >
                {TAB_ICONS[route.name]?.({ color, size: 20 })}
                <Text style={[styles.tabLabel, { color }]}>{label}</Text>
                {badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Backdrop />
      <PushBootstrap />
      <View style={{ paddingTop: insets.top }}>
        <Header />
      </View>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      >
        <Tabs.Screen name="connect" options={{ title: "Shoots" }} />
        <Tabs.Screen name="events" options={{ title: "Explore" }} />
        <Tabs.Screen name="messages" options={{ title: "Matches" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarOuter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
  },
  tabBarGlass: {},
  tabBar: {
    padding: TAB_BAR_PAD,
    flexDirection: "row",
    position: "relative",
  },
  pill: {
    position: "absolute",
    top: TAB_BAR_PAD,
    bottom: TAB_BAR_PAD,
    left: 0,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    gap: 3,
    borderRadius: radii.xl,
    position: "relative",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },
});
