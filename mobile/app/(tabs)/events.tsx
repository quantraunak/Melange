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
import { useRouter } from "expo-router";
import { Calendar, Check, Clock, MapPin, Plus, Star, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii, shadows } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getExplorePosts, type PostWithCreator } from "@/lib/db";
import {
  cancelRsvp,
  categoryDisplay,
  getUpcomingEvents,
  rsvpToEvent,
  type EventWithDetails,
} from "@/lib/events";

type SubTab = "ideas" | "events";

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

export default function ExploreScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("ideas");

  const [ideas, setIdeas] = useState<PostWithCreator[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadIdeas = useCallback(async () => {
    if (!userId) return;
    setIdeasError(null);
    const { data, error: err } = await getExplorePosts(userId);
    if (err) setIdeasError(err);
    setIdeas(data || []);
    setIdeasLoading(false);
  }, [userId]);

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: err } = await getUpcomingEvents(userId, cityFilter.trim() || undefined);
    if (err) setError(err);
    setEvents(data || []);
    setEventsLoading(false);
    setRefreshing(false);
  }, [userId, cityFilter]);

  useEffect(() => {
    if (subTab === "ideas") {
      setIdeasLoading(true);
      loadIdeas();
    } else {
      setEventsLoading(true);
      loadEvents();
    }
  }, [subTab, loadIdeas, loadEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (subTab === "ideas") {
      loadIdeas().finally(() => setRefreshing(false));
    } else {
      loadEvents();
    }
  }, [subTab, loadIdeas, loadEvents]);

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

  const loading = subTab === "ideas" ? ideasLoading : eventsLoading;

  if (loading && !refreshing) {
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
      <View style={styles.subTabRow}>
        {(["ideas", "events"] as SubTab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setSubTab(key)}
            style={[styles.subTab, subTab === key && styles.subTabOn]}
          >
            <Text style={[styles.subTabText, subTab === key && styles.subTabTextOn]}>
              {key === "ideas" ? "Ideas" : "Events"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.hostBtn}
          onPress={() =>
            subTab === "ideas"
              ? router.push("/post/new")
              : router.push("/event/new")
          }
        >
          <Plus size={16} color={colors.white} />
          <Text style={styles.hostBtnText}>{subTab === "ideas" ? "New idea" : "Host event"}</Text>
        </Pressable>
      </View>

      {subTab === "ideas" ? (
        <>
          <ErrorBanner message={ideasError} />
          {ideas.length === 0 && !ideasError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No collaboration ideas yet</Text>
              <Text style={styles.emptyBody}>
                Post what you are looking for, or check back when more creators join your city.
              </Text>
              <Pressable style={styles.hostBtn} onPress={() => router.push("/post/new")}>
                <Plus size={16} color={colors.white} />
                <Text style={styles.hostBtnText}>New idea</Text>
              </Pressable>
            </View>
          ) : (
            ideas.map((post) => {
              const thumb = post.media_urls?.[0];
              return (
                <Pressable
                  key={post.id}
                  style={styles.ideaCard}
                  onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.ideaThumb} />
                  ) : (
                    <View style={[styles.ideaThumb, styles.ideaThumbEmpty]} />
                  )}
                  <View style={styles.ideaBody}>
                    <Text style={styles.ideaTitle} numberOfLines={1}>
                      {post.title}
                    </Text>
                    <Text style={styles.ideaCreator} numberOfLines={1}>
                      {post.creator.name}
                    </Text>
                    {post.location ? (
                      <Text style={styles.ideaMeta} numberOfLines={1}>
                        {post.location}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      ) : (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              value={cityFilter}
              onChangeText={setCityFilter}
              placeholder="Filter by city or location…"
              placeholderTextColor={colors.textSubtle}
              style={styles.search}
              onSubmitEditing={loadEvents}
            />
            {cityFilter ? (
              <Pressable onPress={() => setCityFilter("")} style={styles.clearBtn}>
                <X size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ErrorBanner message={error} />

          {events.length === 0 && !error ? (
            <View style={styles.empty}>
              <Calendar size={40} color={colors.brandSoft} />
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptyBody}>
                Be the first to host a photo walk, open call, or meetup in your city.
              </Text>
              <Pressable style={styles.hostBtn} onPress={() => router.push("/event/new")}>
                <Plus size={16} color={colors.white} />
                <Text style={styles.hostBtnText}>Host event</Text>
              </Pressable>
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
        </>
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
  subTabRow: {
    flexDirection: "row",
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  subTab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  subTabOn: { backgroundColor: colors.brandSoft },
  subTabText: { fontSize: 13, fontWeight: "600", color: "#bfdbfe" },
  subTabTextOn: { color: colors.brandText },
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
  hostBtnText: { color: colors.white, fontWeight: "700", fontSize: 13 },
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
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: "center", maxWidth: 280 },
  ideaCard: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ideaThumb: { width: 64, height: 64, borderRadius: radii.md },
  ideaThumbEmpty: { backgroundColor: colors.brandSoft },
  ideaBody: { flex: 1, justifyContent: "center", gap: 2 },
  ideaTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  ideaCreator: { fontSize: 12, color: colors.accent },
  ideaMeta: { fontSize: 11, color: colors.textSubtle },
  dayGroup: { gap: 10, marginTop: 4 },
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
