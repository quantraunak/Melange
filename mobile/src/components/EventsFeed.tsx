import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Calendar, Check, Clock, MapPin, MessageCircle, Plus, Star, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, fonts, radii, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  cancelRsvp,
  categoryDisplay,
  getPastEvents,
  getUpcomingEvents,
  rsvpToEvent,
  type EventWithDetails,
} from "@/lib/events";

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

/**
 * Events: coming up, and the ones that already happened.
 *
 * Renders into its parent's ScrollView (Explore, or the stand-alone Events
 * screen); bump `reloadKey` from the parent's pull-to-refresh to reload. Past
 * events stay up as ideas, and every host is a way to reach them: the byline
 * opens their profile, Message opens a conversation without a match.
 */
export function EventsFeed({ reloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter();
  const { userId } = useAuth();

  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [pastEvents, setPastEvents] = useState<EventWithDetails[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const [{ data, error: err }, past] = await Promise.all([
      getUpcomingEvents(userId, cityFilter.trim() || undefined),
      getPastEvents(userId),
    ]);
    if (err) setError(err);
    setEvents(data || []);
    const city = cityFilter.trim().toLowerCase();
    setPastEvents(
      (past.data || []).filter(
        (e) =>
          !city ||
          (e.city ?? "").toLowerCase().includes(city) ||
          (e.location_name ?? "").toLowerCase().includes(city)
      )
    );
    setEventsLoading(false);
    setRefreshing(false);
  }, [userId, cityFilter]);

  // Initial load. Deliberately keyed on [userId] (not
  // loadEvents) so that typing in the city filter — which changes loadEvents's
  // identity — never re-triggers the full-screen loading gate.
  useEffect(() => {
    if (!userId) {
      // No fallback: make sure the spinner can't hang forever if userId is
      // transiently null when this effect fires (e.g. an auth race).
      setEventsLoading(false);
      return;
    }
    setEventsLoading(true);
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Debounced city-filter refetch. Uses the RefreshControl's `refreshing`
  // state (a small top-of-list spinner) instead of the initial-load
  // `loading` gate, so the TextInput is never unmounted while typing.
  useEffect(() => {
    if (!userId) return;
    const handle = setTimeout(() => {
      setRefreshing(true);
      loadEvents();
    }, 400);
    return () => clearTimeout(handle);
    // Intentionally only reacts to cityFilter changes — userId
    // changes are already handled by the initial-load effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  useEffect(() => {
    if (reloadKey > 0) loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const openProfile = (id: string) => router.push({ pathname: "/profile/[userId]", params: { userId: id } });
  const message = (e: EventWithDetails) =>
    router.push({
      pathname: "/message/[userId]",
      params: { userId: e.host_id, origin: "event", originId: e.id, about: e.title },
    });

  const handleRsvp = async (event: EventWithDetails, next: "going" | "interested" | null) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyId(event.id);
    const { error: err } =
      next === null ? await cancelRsvp(event.id, userId) : await rsvpToEvent(event.id, userId, next);
    if (err) {
      // Don't apply the optimistic update on failure — surface the error
      // instead of silently diverging from the backend state.
      setError(err);
      setBusyId(null);
      return;
    }
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

  if (eventsLoading && !refreshing) {
    return (
      <View style={styles.feed}>
        <Skeleton height={40} radius={radii.sm} />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.feed}>
      <View style={styles.actionRow}>
        <Pressable style={styles.hostBtn} onPress={() => router.push("/event/new")}>
          <Plus size={16} color={colors.white} />
          <Text style={styles.hostBtnText}>Post an event</Text>
        </Pressable>
      </View>

      <>
          <View style={styles.searchWrap}>
            <TextInput
              value={cityFilter}
              onChangeText={setCityFilter}
              placeholder="Filter by city or location…"
              placeholderTextColor={colors.textTertiary}
              style={styles.search}
              onSubmitEditing={() => {
                setRefreshing(true);
                loadEvents();
              }}
            />
            {cityFilter ? (
              <Pressable onPress={() => setCityFilter("")} style={styles.clearBtn}>
                <X size={16} color={colors.iconFaint} />
              </Pressable>
            ) : null}
          </View>

          <ErrorBanner message={error} />

          {events.length === 0 && !error ? (
            <View style={styles.empty}>
              <Calendar size={40} color={colors.surfaceSunken} />
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptyBody}>
                Be the first to post a photo walk, open call, or meetup in your city.
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
                    isMine={e.host_id === userId}
                    onRsvp={(next) => handleRsvp(e, next)}
                    onOpenHost={() => openProfile(e.host_id)}
                    onMessage={() => message(e)}
                  />
                ))}
              </View>
            ))
          )}

          {pastEvents.length ? (
            <View style={styles.dayGroup}>
              <Text style={styles.dayLabel}>Already happened</Text>
              <Text style={styles.pastHint}>Ideas from around you. Ask the host about the next one.</Text>
              {pastEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  past
                  busy={false}
                  isMine={e.host_id === userId}
                  onRsvp={() => {}}
                  onOpenHost={() => openProfile(e.host_id)}
                  onMessage={() => message(e)}
                />
              ))}
            </View>
          ) : null}
        </>
    </View>
  );
}

function EventCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={140} radius={0} />
      <View style={styles.cardBody}>
        <Skeleton width="30%" height={11} />
        <Skeleton width="70%" height={16} style={{ marginTop: 6 }} />
        <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

function EventCard({
  event,
  busy,
  past = false,
  isMine,
  onRsvp,
  onOpenHost,
  onMessage,
}: {
  event: EventWithDetails;
  busy: boolean;
  past?: boolean;
  isMine: boolean;
  onRsvp: (next: "going" | "interested" | null) => void;
  onOpenHost: () => void;
  onMessage: () => void;
}) {
  const cat = categoryDisplay(event.category);
  const { day, time } = formatEventTime(event.start_at);
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
          <Text style={styles.timePillText}>{past ? day : time}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.catText}>
          {cat.emoji} {cat.label}
        </Text>
        <Text style={styles.cardTitle}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.metaText} numberOfLines={past ? 3 : 2}>
            {event.description}
          </Text>
        ) : null}
        {event.location_name ? (
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.iconFaint} />
            <Text style={styles.metaText} numberOfLines={1}>
              {event.location_name}
            </Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.hostRow, pressed && styles.pressedOpacity]}
          onPress={isMine ? undefined : onOpenHost}
          disabled={isMine}
          accessibilityRole={isMine ? undefined : "button"}
          accessibilityLabel={isMine ? undefined : `${event.host.name}'s profile`}
        >
          <Avatar
            creator={{ name: event.host.name, avatar_url: event.host.avatar_url }}
            size="sm"
          />
          <Text style={styles.hostText} numberOfLines={1}>
            {isMine ? "Hosted by you" : `Hosted by ${event.host.name}`}
          </Text>
          {event.going_count > 0 ? (
            <View style={styles.goingCount}>
              <Users size={12} color={colors.iconFaint} />
              <Text style={styles.goingCountText}>{event.going_count}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {past ? (
        isMine ? null : (
          <Pressable
            style={({ pressed }) => [styles.rsvpRow, styles.rsvpBtn, pressed && styles.pressedOpacity]}
            onPress={onMessage}
          >
            <MessageCircle size={14} color={colors.accentInk} />
            <Text style={[styles.rsvpLabel, { color: colors.accentInk }]}>
              Message {event.host.name.split(" ")[0]} about it
            </Text>
          </Pressable>
        )
      ) : (
      <View style={styles.rsvpRow}>
        <Pressable
          style={({ pressed }) => [
            styles.rsvpBtn,
            interested && styles.rsvpInterested,
            pressed && styles.pressedOpacity,
          ]}
          onPress={() => onRsvp(interested ? null : "interested")}
          disabled={busy}
        >
          <Star size={14} color={interested ? colors.brandText : colors.textSecondary} fill={interested ? colors.brandText : "transparent"} />
          <Text style={[styles.rsvpLabel, interested && styles.rsvpLabelActive]}>Interested</Text>
        </Pressable>
        <View style={styles.rsvpDivider} />
        <Pressable
          style={({ pressed }) => [
            styles.rsvpBtn,
            going && styles.rsvpGoing,
            pressed && styles.pressedOpacity,
          ]}
          onPress={() => onRsvp(going ? null : "going")}
          disabled={busy}
        >
          <Check size={14} color={going ? colors.white : colors.textSecondary} />
          <Text style={[styles.rsvpLabel, going && styles.rsvpLabelGoing]}>
            {going ? "Going" : "I'm going"}
          </Text>
        </Pressable>
        {isMine ? null : (
          <>
            <View style={styles.rsvpDivider} />
            <Pressable
              style={({ pressed }) => [styles.rsvpBtn, pressed && styles.pressedOpacity]}
              onPress={onMessage}
              accessibilityLabel={`Message ${event.host.name}`}
            >
              <MessageCircle size={14} color={colors.textSecondary} />
              <Text style={styles.rsvpLabel}>Message</Text>
            </Pressable>
          </>
        )}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { gap: 12 },
  pastHint: { ...typography.caption, color: colors.textSecondary, marginTop: -4 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end" },
  hostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  hostBtnText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.white },
  searchWrap: { position: "relative" },
  search: { ...typography.body, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, paddingRight: 36 },
  clearBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: { ...typography.headline, color: colors.text },
  emptyBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
  pressedOpacity: { opacity: 0.75 },
  dayGroup: { gap: 10, marginTop: 4 },
  dayLabel: { ...typography.micro, fontFamily: fonts.semibold, color: colors.textSecondary, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: "hidden",
  },
  cover: { height: 140, backgroundColor: colors.surfaceSunken },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverEmoji: { ...typography.display1 },
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
  timePillText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.white },
  cardBody: { padding: 12, gap: 6 },
  catText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.textSecondary },
  cardTitle: { ...typography.headline, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  hostText: { ...typography.caption, flex: 1, color: colors.textSecondary },
  goingCount: { flexDirection: "row", alignItems: "center", gap: 2 },
  goingCountText: { ...typography.micro, color: colors.textSecondary },
  rsvpRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.lineStrong,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  rsvpInterested: { backgroundColor: colors.accentSoft },
  rsvpGoing: { backgroundColor: colors.accent },
  rsvpDivider: { width: 1, backgroundColor: colors.lineStrong },
  rsvpLabel: { ...typography.caption, fontFamily: fonts.semibold, color: colors.textSecondary },
  rsvpLabelActive: { color: colors.brandText },
  rsvpLabelGoing: { color: colors.white },
});
