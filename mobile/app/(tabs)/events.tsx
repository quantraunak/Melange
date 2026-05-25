import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar, Check, Clock, MapPin, Star, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuth } from "@/lib/auth";
import {
  cancelRsvp,
  categoryDisplay,
  getUpcomingEvents,
  rsvpToEvent,
  type EventWithDetails,
} from "@/lib/events";
import { colors, radii, shadows } from "@/lib/theme";

function formatEventTime(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfToday) / dayMs
  );
  let day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (dayDiff === 0) day = "Today";
  else if (dayDiff === 1) day = "Tomorrow";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return { day, time };
}

export default function EventsScreen() {
  const { userId } = useAuth();
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: err } = await getUpcomingEvents(userId, cityFilter.trim() || undefined);
    if (err) setError(err);
    setEvents(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [userId, cityFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRsvp = async (event: EventWithDetails, next: "going" | "interested" | null) => {
    if (!userId) return;
    setBusyId(event.id);
    if (next === null) await cancelRsvp(event.id, userId);
    else await rsvpToEvent(event.id, userId, next);

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== event.id) return e;
        let going = e.going_count;
        let interested = e.interested_count;
        if (e.my_rsvp === "going") going -= 1;
        if (e.my_rsvp === "interested") interested -= 1;
        if (next === "going") going += 1;
        if (next === "interested") interested += 1;
        return {
          ...e,
          my_rsvp: next,
          going_count: Math.max(0, going),
          interested_count: Math.max(0, interested),
        };
      })
    );
    setBusyId(null);
  };

  const grouped = (() => {
    const map = new Map<string, EventWithDetails[]>();
    for (const e of events) {
      const key = formatEventTime(e.start_at).day;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  })();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Events near you</Text>
      <Text style={styles.subheading}>
        Photo walks, open calls, and meetups hosted by the community.
      </Text>

      <View style={styles.searchWrap}>
        <TextInput
          value={cityFilter}
          onChangeText={setCityFilter}
          placeholder="Filter by city or location…"
          placeholderTextColor={colors.textSubtle}
          style={styles.search}
          onSubmitEditing={load}
        />
        {cityFilter ? (
          <Pressable onPress={() => { setCityFilter(""); }} style={styles.clearBtn}>
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.filterBtn} onPress={load}>
        <Text style={styles.filterBtnText}>Apply filter</Text>
      </Pressable>

      <ErrorBanner message={error} />

      {events.length === 0 && !error ? (
        <View style={styles.empty}>
          <Calendar size={40} color={colors.brandSoft} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptyBody}>
            Host on the web app for now — mobile hosting is coming soon.
          </Text>
        </View>
      ) : (
        grouped.map(([day, dayEvents]) => (
          <View key={day} style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{day}</Text>
            {dayEvents.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                busy={busyId === e.id}
                onRsvp={(next) => handleRsvp(e, next)}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function EventCard({
  event,
  busy,
  onRsvp,
}: {
  event: EventWithDetails;
  busy: boolean;
  onRsvp: (next: "going" | "interested" | null) => void;
}) {
  const cat = categoryDisplay(event.category);
  const { time } = formatEventTime(event.start_at);
  const going = event.my_rsvp === "going";
  const interested = event.my_rsvp === "interested";

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.cover}>
        {event.cover_url ? (
          <Image source={{ uri: event.cover_url }} style={styles.coverImg} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverEmoji}>{cat.emoji}</Text>
          </View>
        )}
        <View style={styles.timePill}>
          <Clock size={12} color={colors.white} />
          <Text style={styles.timePillText}>{time}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.catText}>
          {cat.emoji} {cat.label}
        </Text>
        <Text style={styles.cardTitle}>{event.title}</Text>
        {event.location_name ? (
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.textSubtle} />
            <Text style={styles.metaText} numberOfLines={1}>
              {event.location_name}
            </Text>
          </View>
        ) : null}
        <View style={styles.hostRow}>
          <Avatar
            creator={{ name: event.host.name, avatar_url: event.host.avatar_url }}
            size="sm"
          />
          <Text style={styles.hostText} numberOfLines={1}>
            Hosted by {event.host.name}
          </Text>
          {event.going_count > 0 ? (
            <View style={styles.goingCount}>
              <Users size={12} color={colors.textSubtle} />
              <Text style={styles.goingCountText}>{event.going_count}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.rsvpRow}>
        <Pressable
          style={[styles.rsvpBtn, interested && styles.rsvpInterested]}
          onPress={() => onRsvp(interested ? null : "interested")}
          disabled={busy}
        >
          <Star size={14} color={interested ? colors.brandText : colors.textMuted} fill={interested ? colors.brandText : "transparent"} />
          <Text style={[styles.rsvpLabel, interested && styles.rsvpLabelActive]}>Interested</Text>
        </Pressable>
        <View style={styles.rsvpDivider} />
        <Pressable
          style={[styles.rsvpBtn, going && styles.rsvpGoing]}
          onPress={() => onRsvp(going ? null : "going")}
          disabled={busy}
        >
          <Check size={14} color={going ? colors.white : colors.textMuted} />
          <Text style={[styles.rsvpLabel, going && styles.rsvpLabelGoing]}>
            {going ? "Going" : "I'm going"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  heading: { fontSize: 20, fontWeight: "800", color: colors.text },
  subheading: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  searchWrap: { position: "relative" },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    paddingRight: 36,
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  filterBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  filterBtnText: { color: colors.brandText, fontWeight: "700", fontSize: 13 },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: "center", maxWidth: 280 },
  dayGroup: { gap: 10, marginTop: 8 },
  dayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cover: { height: 140, backgroundColor: colors.brandSoft },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverEmoji: { fontSize: 40 },
  timePill: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  timePillText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  cardBody: { padding: 12, gap: 6 },
  catText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  hostText: { flex: 1, fontSize: 12, color: colors.textMuted },
  goingCount: { flexDirection: "row", alignItems: "center", gap: 2 },
  goingCountText: { fontSize: 11, color: colors.textSubtle },
  rsvpRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  rsvpInterested: { backgroundColor: "#fef9c3" },
  rsvpGoing: { backgroundColor: colors.like },
  rsvpDivider: { width: 1, backgroundColor: colors.border },
  rsvpLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  rsvpLabelActive: { color: colors.brandText },
  rsvpLabelGoing: { color: colors.white },
});
