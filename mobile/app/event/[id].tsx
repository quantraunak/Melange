import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CalendarDays, MapPin, MessageCircle } from "lucide-react-native";

import { supabase } from "@/lib/supabase";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  categoryDisplay,
  getEvent,
  getEventAttendees,
  type AttendeeInfo,
  type EventWithDetails,
} from "@/lib/events";

type Person = { user_id: string; name: string; role: string | null; avatar_url: string | null };

function when(event: EventWithDetails): string {
  const d = new Date(event.start_at);
  const date = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/**
 * One event: what it is, who's hosting, and everyone going or interested.
 * Every person here opens their profile, and every one of them can be
 * messaged — the point of a photo walk is the people you meet on it.
 */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [going, setGoing] = useState<AttendeeInfo[]>([]);
  const [interested, setInterested] = useState<AttendeeInfo[]>([]);

  // Which of these people can actually be messaged, answered by the server.
  //
  // can_message() applies a block in either direction, whether a thread or a
  // heart already exists, and the cold-approach floor. None of that is
  // visible from here, and guessing is how the button and the send drift
  // apart: Raunak pressed Message on someone he and that person had blocked
  // back in August, wrote a message, and only then was told he could not.
  const [reachable, setReachable] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const ids = [...new Set([...going, ...interested].map((a) => a.user_id))].filter(
      (id) => id !== userId
    );
    if (!ids.length) return;
    let alive = true;
    Promise.all(
      ids.map((id) =>
        supabase
          .rpc("can_message", { p_other: id })
          .then(({ data, error }) => [id, error ? true : data === true] as const)
      )
    ).then((pairs) => {
      if (alive) setReachable(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [going, interested, userId]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    const [e, g, i] = await Promise.all([
      getEvent(id, userId),
      getEventAttendees(id, "going"),
      getEventAttendees(id, "interested"),
    ]);
    setEvent(e.data);
    setError(e.error ?? g.error ?? i.error);
    setGoing(g.data);
    setInterested(i.data);
    setLoading(false);
    setRefreshing(false);
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openProfile = (uid: string) => {
    if (uid === userId) router.push("/(tabs)/profile");
    else router.push({ pathname: "/profile/[userId]", params: { userId: uid } });
  };

  const message = (uid: string) => {
    if (!event) return;
    router.push({
      pathname: "/message/[userId]",
      params: { userId: uid, origin: "event", originId: event.id, about: event.title },
    });
  };

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.center}>
          <ErrorBanner message={error || "This event isn't available."} />
        </View>
      </SafeAreaView>
    );
  }

  const cat = categoryDisplay(event.category);
  const hostIsMe = event.host_id === userId;


  const personRow = (p: Person, note?: string) => (
    <View key={p.user_id} style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.who, pressed && { opacity: 0.6 }]}
        onPress={() => openProfile(p.user_id)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}'s profile`}
      >
        <Avatar creator={p} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {p.user_id === userId ? "You" : p.name}
          </Text>
          {p.role || note ? (
            <Text style={styles.meta} numberOfLines={1}>
              {[note, p.role && p.role !== "other" ? p.role : null].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {/* Only when the server says it will work. A button that opens a
          composer, accepts a message and then refuses is worse than none. */}
      {p.user_id !== userId && reachable[p.user_id] ? (
        <Pressable
          onPress={() => message(p.user_id)}
          style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Message ${p.name}`}
        >
          <MessageCircle size={15} color={colors.onAccent} />
          <Text style={styles.msgText}>Message</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.textSecondary}
          />
        }
      >
        {event.cover_url ? (
          <Image source={{ uri: event.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Text style={styles.coverEmoji}>{cat.emoji}</Text>
          </View>
        )}

        <Text style={styles.cat}>
          {cat.emoji} {cat.label}
          {event.is_canceled ? " · Canceled" : ""}
        </Text>
        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.facts}>
          <View style={styles.fact}>
            <CalendarDays size={15} color={colors.iconFaint} />
            <Text style={styles.factText}>{when(event)}</Text>
          </View>
          {event.location_name || event.city ? (
            <View style={styles.fact}>
              <MapPin size={15} color={colors.iconFaint} />
              <Text style={styles.factText}>
                {[event.location_name, event.city].filter(Boolean).join(", ")}
              </Text>
            </View>
          ) : null}
        </View>

        {event.description ? <Text style={styles.body}>{event.description}</Text> : null}

        <ErrorBanner message={error} />

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Host</Text>
          {personRow(event.host, hostIsMe ? "Hosting" : undefined)}
        </View>

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Going ({going.length})</Text>
          {going.length ? (
            going.map((p) => personRow(p))
          ) : (
            <Text style={styles.muted}>Nobody yet.</Text>
          )}
        </View>

        {interested.length ? (
          <View style={styles.block}>
            <Text style={styles.eyebrow}>Interested ({interested.length})</Text>
            {interested.map((p) => personRow(p))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: GUTTER, paddingVertical: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xxxl, gap: spacing.sm },
  cover: { width: "100%", height: 200, borderRadius: radii.md, backgroundColor: colors.surfaceSunken },
  coverEmpty: { alignItems: "center", justifyContent: "center" },
  coverEmoji: { ...typography.display1 },
  cat: { ...typography.micro, fontFamily: fonts.semibold, color: colors.textSecondary, marginTop: spacing.md },
  title: { ...typography.display2, color: colors.text },
  facts: { gap: spacing.xs, marginTop: spacing.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  factText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  body: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  msgText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.onAccent },
});
