import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Settings as SettingsIcon } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { BrandHeader } from "@/components/BrandHeader";
import { useAuth } from "@/lib/auth";
import { MatchesProvider, useMatches } from "@/lib/matches";
import { registerForPushAsync } from "@/lib/push";
import { colors, radii } from "@/lib/theme";

function PushBootstrap() {
  const { userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    registerForPushAsync(userId).catch(() => {});

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
          onPress={() => router.push("/(tabs)/profile")}
          accessibilityLabel="Settings"
        >
          <SettingsIcon size={20} color="#60a5fa" />
        </Pressable>
      }
    />
  );
}

const TAB_BAR_PAD = 4;

function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { unreadCount } = useMatches();
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
    <SafeAreaView edges={["bottom"]} style={styles.tabBarOuter}>
      <View
        style={styles.tabBar}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {pillWidth > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          const badge = route.name === "messages" ? unreadCount : 0;

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
              onPress={onPress}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {label}
              </Text>
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  return (
    <MatchesProvider>
      <PushBootstrap />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Header />
      </SafeAreaView>
      <Tabs
        tabBar={(props) => <PillTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="connect" options={{ title: "Connect" }} />
        <Tabs.Screen name="events" options={{ title: "Explore" }} />
        <Tabs.Screen name="messages" options={{ title: "Messages" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </MatchesProvider>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white },
  tabBarOuter: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabBar: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    padding: TAB_BAR_PAD,
    flexDirection: "row",
    position: "relative",
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pill: {
    position: "absolute",
    top: TAB_BAR_PAD,
    bottom: TAB_BAR_PAD,
    left: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: radii.pill,
    position: "relative",
  },
  tabLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: colors.brandText,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },
});
