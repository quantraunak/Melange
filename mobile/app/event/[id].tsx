import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Share as ShareIcon,
} from "lucide-react-native";

import { supabase } from "@/lib/supabase";

import { Avatar } from "@/components/Avatar";
import { MatchCelebration } from "@/components/MatchCelebration";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FOUNDING_MARK } from "@/components/IdentityLine";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { getProfile } from "@/lib/db";
import {
  cancelRsvp,
  categoryDisplay,
  getEvent,
  getEventAttendees,
  isEventFull,
  rsvpToEvent,
  type AttendeeInfo,
  type EventWithDetails,
} from "@/lib/events";
import {
  afterglowOpen,
  getNightMutuals,
  getNightPeople,
  isNightMember,
  nightEnded,
  toggleNightHeart,
  type NightMutual,
  type NightPerson,
} from "@/lib/nights";
import { sceneLabel } from "@/lib/scenes";

/** The public night page (web /n/[id]); get_shared_event serves it signed out. */
const NIGHT_URL = "https://melange-psi.vercel.app/n";

type Person = { user_id: string; name: string; role: string | null; avatar_url: string | null };

const { width: SCREEN_W } = Dimensions.get("window");
/** Three people across inside the gutter. */
const GLOW_TILE = (SCREEN_W - GUTTER * 2 - spacing.md * 2) / 3;

function when(event: EventWithDetails): string {
  const d = new Date(event.start_at);
  const date = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/**
 * One night: what it is, RSVP, who's going, the night chat, and — from the
 * start of the night until three days after — Afterglow, where you can heart
 * people you met. Every person here opens their profile.
 */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [going, setGoing] = useState<AttendeeInfo[]>([]);
  const [interested, setInterested] = useState<AttendeeInfo[]>([]);
  const [people, setPeople] = useState<NightPerson[]>([]);
  const [mutuals, setMutuals] = useState<NightMutual[]>([]);
  const [me, setMe] = useState<{ name: string; avatar_url: string | null }>({ name: "You", avatar_url: null });
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [hearting, setHearting] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<{ them: NightPerson; matchId: string | null } | null>(null);

  // Which of these people can actually be messaged, answered by the server.
  //
  // can_message() applies a block in either direction, whether a thread or a
  // heart already exists, and the cold-approach floor. None of that is
  // visible from here, and guessing is how the button and the send drift
  // apart: Raunak pressed Message on someone he and that person had blocked
  // back in August, wrote a message, and only then was told he could not.
  const [reachable, setReachable] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const ids = [
      ...new Set([...going, ...interested, ...people].map((a) => a.user_id)),
    ].filter((id) => id !== userId);
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
  }, [going, interested, people, userId]);
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
    // event_people and the mutuals are members-only; asking otherwise just
    // comes back empty, so don't.
    if (e.data && isNightMember(e.data, userId)) {
      const [p, m] = await Promise.all([getNightPeople(id), getNightMutuals(id)]);
      setPeople(p.data);
      setMutuals(m.data);
      if (p.error) setError(p.error);
    } else {
      setPeople([]);
      setMutuals([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from the night chat or a profile: the going list may have moved.
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(({ data }) => {
      if (data) setMe({ name: data.name, avatar_url: data.avatar_url });
    });
  }, [userId]);

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

  const rsvp = async (next: "going" | "interested" | null) => {
    if (!userId || !event || rsvpBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRsvpBusy(true);
    setError(null);
    const { error: err } =
      next === null ? await cancelRsvp(event.id, userId) : await rsvpToEvent(event.id, userId, next);
    if (err) {
      setRsvpBusy(false);
      setError(err);
      return;
    }
    // Going changes who's in the chat and who's on the list; read it all back
    // rather than guess at the counts.
    await load();
    setRsvpBusy(false);
  };

  /**
   * Optimistic, because a heart that waits on the network feels like it
   * didn't take. On failure it flips back and says why.
   */
  const toggleHeart = async (person: NightPerson) => {
    if (!event || hearting.has(person.user_id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const was = person.i_hearted;
    const flip = (v: boolean) =>
      setPeople((prev) => prev.map((p) => (p.user_id === person.user_id ? { ...p, i_hearted: v } : p)));
    flip(!was);
    setHearting((s) => new Set(s).add(person.user_id));
    const { data, error: err } = await toggleNightHeart(event.id, person.user_id);
    setHearting((s) => {
      const n = new Set(s);
      n.delete(person.user_id);
      return n;
    });
    if (err || !data) {
      flip(was);
      Alert.alert("Couldn't save that heart", err ?? "Try again.");
      return;
    }
    flip(data.hearted);
    if (data.mutual) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const [, m] = await Promise.all([refreshMatches(), getNightMutuals(event.id)]);
      setMutuals(m.data);
      setCelebration({ them: person, matchId: data.matchId });
    }
  };

  // Nights are invite-only in the sense that matters: a friend sends you the
  // link. The web page at /n/<id> shows who's going to anyone, signed in or
  // not, and that guest list is what gets people to say yes.
  const invite = async () => {
    if (!event) return;
    try {
      await Share.share({ message: `${event.title} ${NIGHT_URL}/${event.id}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open sharing.");
    }
  };
  const canInvite = !!event && !event.is_canceled && !nightEnded(event);

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
      {canInvite ? (
        <Pressable
          onPress={invite}
          hitSlop={8}
          style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <ShareIcon size={15} color={colors.brandText} />
          <Text style={styles.link}>Invite friends</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const member = !!event && isNightMember(event, userId);
  const glow = !!event && member && afterglowOpen(event);
  const others = useMemo(() => people.filter((p) => p.user_id !== userId), [people, userId]);

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
          <ErrorBanner message={error || "This night isn't available."} />
        </View>
      </SafeAreaView>
    );
  }

  const cat = categoryDisplay(event.category);
  const hostIsMe = event.host_id === userId;
  const ended = nightEnded(event);
  const canRsvp = !hostIsMe && !event.is_canceled && !ended;
  const full = isEventFull(event);
  const scene = sceneLabel(event.scene);
  // Members see who's going through event_people, which carries handles and
  // is block-aware; everyone else sees the RSVP list, as before.
  const goingList: Person[] = member ? people.filter((p) => !p.is_host) : going;

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
      <MatchCelebration
        visible={!!celebration}
        me={me}
        them={celebration?.them ?? null}
        copy={
          celebration
            ? {
                kicker: `It's mutual ${FOUNDING_MARK}`,
                title: `${celebration.them.name.split(" ")[0]} hearted you too`,
                body: "You both want to see each other again. Say hi while the night's still warm.",
                dismiss: "Later",
              }
            : undefined
        }
        onMessage={() => {
          const matchId = celebration?.matchId;
          setCelebration(null);
          if (matchId) router.push({ pathname: "/chat/[matchId]", params: { matchId } });
        }}
        onKeepSwiping={() => setCelebration(null)}
      />

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
          {scene ? <Chip label={scene} size="sm" tone="outline" style={{ alignSelf: "flex-start" }} /> : null}
        </View>

        {event.description ? <Text style={styles.body}>{event.description}</Text> : null}

        <ErrorBanner message={error} />

        {canRsvp ? (
          event.my_rsvp === "going" ? (
            <View style={styles.rsvpRow}>
              <Text style={styles.goingText}>You&apos;re going</Text>
              <Pressable onPress={() => rsvp(null)} disabled={rsvpBusy} hitSlop={8}>
                <Text style={styles.link}>{rsvpBusy ? "Saving…" : "Can't make it"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.rsvpRow}>
              <Button
                title={full ? "Full" : "I'm going"}
                variant="primary"
                loading={rsvpBusy}
                disabled={full}
                onPress={() => rsvp("going")}
                style={{ flex: 1 }}
              />
              <Button
                title={event.my_rsvp === "interested" ? "Interested ✓" : "Interested"}
                variant="outline"
                disabled={rsvpBusy}
                onPress={() => rsvp(event.my_rsvp === "interested" ? null : "interested")}
              />
            </View>
          )
        ) : null}

        {/* The night chat */}
        <View style={styles.block}>
          <Text style={styles.eyebrow}>Night chat</Text>
          {member ? (
            <Button
              title="Open the night chat"
              variant={canRsvp || hostIsMe ? "outline" : "primary"}
              leadingIcon={<MessagesSquare size={16} color={canRsvp || hostIsMe ? colors.text : colors.onBrand} />}
              onPress={() => router.push({ pathname: "/event/chat/[id]", params: { id: event.id } })}
            />
          ) : (
            <Text style={styles.muted}>
              {canRsvp ? "RSVP to join the chat." : "The chat is for the host and everyone who went."}
            </Text>
          )}
        </View>

        {glow ? (
          <View style={styles.block}>
            <Text style={styles.eyebrow}>Afterglow</Text>
            <Text style={styles.glowCopy}>
              Heart anyone you&apos;d like to see again. They&apos;ll only know if they hearted you too.
            </Text>
            {others.length ? (
              <View style={styles.glowGrid}>
                {others.map((p) => (
                  <View key={p.user_id} style={styles.glowTile}>
                    <Pressable onPress={() => openProfile(p.user_id)} accessibilityRole="button" accessibilityLabel={`${p.name}'s profile`}>
                      <Avatar creator={p} size="lg" />
                    </Pressable>
                    <Text style={styles.glowName} numberOfLines={1}>
                      {p.name.split(" ")[0]}
                    </Text>
                    <Pressable
                      onPress={() => toggleHeart(p)}
                      disabled={hearting.has(p.user_id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: p.i_hearted }}
                      accessibilityLabel={p.i_hearted ? `Take back your heart for ${p.name}` : `Heart ${p.name}`}
                      style={[styles.heartBtn, p.i_hearted && styles.heartBtnOn]}
                    >
                      <Heart
                        size={16}
                        color={p.i_hearted ? colors.onAccent : colors.accentInk}
                        fill={p.i_hearted ? colors.onAccent : "transparent"}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Nobody else was on the list.</Text>
            )}

            {mutuals.length ? (
              <>
                <Text style={[styles.eyebrow, { marginTop: spacing.md }]}>Mutual {FOUNDING_MARK}</Text>
                {mutuals.map((m) => (
                  <Pressable
                    key={m.user_id}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                    onPress={() =>
                      m.match_id
                        ? router.push({ pathname: "/chat/[matchId]", params: { matchId: m.match_id } })
                        : openProfile(m.user_id)
                    }
                    accessibilityRole="button"
                  >
                    <Avatar creator={m} size="md" />
                    <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={styles.link}>{m.match_id ? "Say hi" : "Profile"}</Text>
                  </Pressable>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Host</Text>
          {personRow(event.host, hostIsMe ? "Hosting" : undefined)}
        </View>

        <View style={styles.block}>
          <Text style={styles.eyebrow}>
            {ended ? "Went" : "Going"} ({goingList.length})
          </Text>
          {goingList.length ? (
            goingList.map((p) => personRow(p))
          ) : (
            <Text style={styles.muted}>Nobody yet.</Text>
          )}
        </View>

        {interested.length && !ended ? (
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  goingText: { ...typography.bodyStrong, color: colors.accentInk, flex: 1 },
  link: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },
  glowCopy: { ...typography.body, color: colors.textSecondary },
  glowGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
  glowTile: { width: GLOW_TILE, alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  glowName: { ...typography.caption, color: colors.text, fontFamily: fonts.medium },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  heartBtnOn: { backgroundColor: colors.accent },
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
