import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { CalendarDays, Compass, LayoutGrid, MessageCircle, UserRound } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { Glass } from "@/components/ui/Glass";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { registerForPushAsync } from "@/lib/push";
import { colors, GUTTER, radii, typography } from "@/lib/theme";

/** Notification taps already routed, by identifier, for this app run. */
const handledPushes = new Set<string>();

function PushBootstrap() {
  const { userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    // prompt:false — this re-registers the token for someone who has already
    // said yes, and stays silent otherwise. The ask itself belongs to
    // PushPrimer, where there's room to explain it first.
    registerForPushAsync(userId, { prompt: false }).catch(() => {});

    const open = (response: Notifications.NotificationResponse) => {
      // Once per notification: the cold-start check below and the listener
      // can both see the same tap, and this layout remounts on sign-in.
      const key = response.notification.request.identifier;
      if (handledPushes.has(key)) return;
      handledPushes.add(key);
      const data = response.notification.request.content.data as
        | { kind?: string; matchId?: string; eventId?: string; storyId?: string }
        | undefined;
      if (data?.matchId) {
        router.push({ pathname: "/chat/[matchId]", params: { matchId: data.matchId } });
      } else if (data?.kind === "event" && data.eventId) {
        // A tag in a night photo, or anything else about one night: open it.
        router.push({ pathname: "/event/[id]", params: { id: data.eventId } });
      } else if (data?.kind === "story" && data.storyId) {
        router.push({ pathname: "/story/[id]", params: { id: data.storyId } });
      } else if (data?.kind === "heart" || data?.kind === "like") {
        // Who hearted what, with Message, is on the Messages tab.
        router.push("/(tabs)/messages");
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(open);
    // A tap that launched the app from closed happened before the listener
    // existed; it only shows up here.
    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        if (last) open(last);
      })
      .catch(() => {});
    return () => sub.remove();
  }, [userId, router]);

  return null;
}

/**
 * Compass for Discover (you are looking around), a grid for Explore (the
 * scene's moodboard), a moon for Nights. The previous sparkle and open book
 * said nothing: a sparkle is decoration, and a book is not a moodboard.
 */
const TAB_ICONS: Record<string, (p: { color: string; size: number }) => React.ReactNode> = {
  connect: (p) => <Compass {...p} />,
  stories: (p) => <LayoutGrid {...p} />,
  nights: (p) => <CalendarDays {...p} />,
  messages: (p) => <MessageCircle {...p} />,
  profile: (p) => <UserRound {...p} />,
};

const TAB_BAR_PAD = 8;

/** 8 pad + 21 icon + 3 gap + 13 label + 8 pad + 16 (TAB_BAR_PAD×2) + 2 border. */
export const TAB_BAR_H = 67;

/**
 * The top edge of the tab bar, measured from the bottom of the screen.
 *
 * Every screen imports this. Five different hardcoded clearances used to
 * approximate it (92, 112, 112, 150, 120), none of them correct on more than
 * one device, which is how the Like button ended up three points underneath
 * the navigation.
 */
export function useBarTop() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + TAB_BAR_H;
}

/**
 * Floating glass tab bar.
 *
 * Labelled: Discover and Work are product-specific ideas with no
 * conventional glyph, so an icon alone cannot carry them. Selection is the
 * icon and label turning brand blue — there is no sliding indicator, which
 * was Material Design's navigation pill and put the highlight and the
 * highlighted item in different places for a third of a second.
 */
function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { unreadCount } = useMatches();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass variant="strong" radius={radii.lg} elevated style={styles.tabBarGlass}>
        <View style={styles.tabBar}>
          {state.routes.map((route, idx) => {
            // Explore is gone: two tabs that both meant "look at creatives near
            // me" made people ask which to use. Finished shoots live on
            // profiles. The route stays so old links still open.
            if (route.name === "stories") return null;
            const focused = state.index === idx;
            const { options } = descriptors[route.key];
            const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
            const badge = route.name === "messages" ? unreadCount : 0;
            // Selection is ink, not indigo: indigo is for links and the one primary action.
            const color = focused ? colors.text : colors.textTertiary;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;
              if (focused) {
                // Tapping the current tab used to do nothing at all. Screens
                // listen for this and scroll themselves to the top.
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                return;
              }
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name);
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
                {TAB_ICONS[route.name]?.({ color, size: 21 })}
                <Text
                  style={[styles.tabLabel, focused && styles.tabLabelOn]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
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
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <PushBootstrap />
      <Tabs
        initialRouteName="connect"
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      >
        <Tabs.Screen name="connect" options={{ title: "Discover" }} />
        <Tabs.Screen name="stories" options={{ title: "Explore" }} />
        <Tabs.Screen name="nights" options={{ title: "Events" }} />
        <Tabs.Screen name="messages" options={{ title: "Messages" }} />
        <Tabs.Screen name="profile" options={{ title: "You" }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBarOuter: {
    position: "absolute",
    left: GUTTER,
    right: GUTTER,
    bottom: 0,
  },
  tabBarGlass: {},
  tabBar: {
    padding: TAB_BAR_PAD,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    position: "relative",
  },
  tabLabel: { ...typography.micro, color: colors.textTertiary },
  tabLabelOn: { fontFamily: "Inter_600SemiBold", color: colors.text },
  badge: {
    position: "absolute",
    top: 2,
    right: "22%",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...typography.micro, color: colors.white, lineHeight: 14 },
});
