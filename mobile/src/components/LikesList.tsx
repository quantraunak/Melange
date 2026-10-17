import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Heart, MessageCircle } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { colors, fonts, radii, spacing, typography } from "@/lib/theme";
import { useMatches } from "@/lib/matches";
import { supabase } from "@/lib/supabase";
import { getMyLikes, likeTarget, type LikeRow } from "@/lib/hearts";
import { formatListTime } from "@/lib/format";

type Person = { user_id: string; name: string; role: string | null; avatar_url: string | null };

/**
 * How many hearts each direction shows. The ninth person to heart you used to
 * simply not appear — no count, no "see all", nothing saying the list was cut.
 * The overflow line below at least admits it.
 */
const SHOWN = 8;

/**
 * Hearts, on the Messages tab: who hearted your profile, project or work, and
 * what you hearted. Every row names what was hearted and has Message, because
 * a heart either way is the go-ahead to talk. The face opens their profile.
 */
export function LikesList({ reloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter();
  const { matches } = useMatches();
  const [rows, setRows] = useState<LikeRow[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [showSent, setShowSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The error is kept. Dropping it made a failed my_likes render exactly
    // like having no hearts — no section, no banner, nothing in the log — so
    // an expired token or a missing migration was indistinguishable from
    // nobody liking you, which is the worse of the two to be told silently.
    const { data, error: likesErr } = await getMyLikes();
    if (likesErr) {
      setError(likesErr);
      return;
    }
    setError(null);
    const ids = [...new Set(data.map((r) => r.other_user))];
    if (!ids.length) {
      setRows(data);
      return;
    }
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("user_id,name,role,avatar_url")
      .in("user_id", ids);
    if (profErr) {
      setError(profErr.message);
      return;
    }
    // Both together, so no row ever flashes as "Someone" with a blank face
    // while the names are still in flight.
    setPeople(new Map(((profs || []) as Person[]).map((p) => [p.user_id, p])));
    setRows(data);
  }, []);

  // Focus alone. This used to also run on mount, so opening Messages fired
  // my_likes and the profiles lookup twice every single time.

  useFocusEffect(
    useCallback(() => {
      load();
      // reloadKey is in here rather than in its own effect so a pull-to-refresh
      // still reloads without the mount running the whole thing twice.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, reloadKey])
  );

  // Someone you already have a thread with is not a lead, and my_likes counts
  // every mutual right-swipe as a project like. All four existing matches have
  // one underneath them, so without this every single user would open Messages
  // and find "They hearted yours. Say hi." sitting directly above a
  // conversation they have been having for weeks, with no way to dismiss it.
  const talking = new Set(matches.map((m) => m.other_user_id));
  const received = rows.filter((r) => r.direction === "received" && !talking.has(r.other_user));
  const sent = rows.filter((r) => r.direction === "sent" && !talking.has(r.other_user));
  if (error) {
    return (
      <Text style={styles.more}>Couldn&apos;t load your hearts. Pull to refresh.</Text>
    );
  }
  if (!received.length && !sent.length) return null;

  const message = (r: LikeRow, name: string) => {
    const thread = matches.find((m) => m.other_user_id === r.other_user);
    if (thread) {
      router.push({ pathname: "/chat/[matchId]", params: { matchId: thread.id } });
      return;
    }
    // Only a heart you GAVE describes something of theirs. On a heart you
    // RECEIVED, target_id and title are your OWN project or work, and the
    // composer writes its opener from the admirer's side — so this used to
    // pre-fill "I saw 'Rooftop Editorial' and I'd love to be part of it" to
    // the person who had just hearted your own Rooftop Editorial. It also
    // made start_conversation's `owner_id = p_other` lookup miss, so the
    // thread got no label either.
    const theirs = r.direction === "sent";
    router.push({
      pathname: "/message/[userId]",
      params: {
        userId: r.other_user,
        origin: theirs ? r.kind : "profile",
        originId: theirs ? r.target_id : undefined,
        about: theirs
          ? r.title ?? (r.kind === "profile" ? `${name}'s profile` : undefined)
          : undefined,
      },
    });
  };

  const renderRow = (r: LikeRow) => {
    const p = people.get(r.other_user);
    const name = p?.name ?? "Someone";
    const line =
      r.direction === "received" ? `${name} hearted ${likeTarget(r)}` : `You hearted ${likeTarget(r)}`;
    return (
      <View key={`${r.direction}-${r.kind}-${r.target_id}-${r.other_user}`} style={styles.row}>
        <Pressable
          onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: r.other_user } })}
          accessibilityRole="button"
          accessibilityLabel={`${name}'s profile`}
          style={styles.who}
        >
          <View>
            <Avatar creator={{ name, avatar_url: p?.avatar_url ?? null }} size="md" />
            <View style={styles.heartBadge}>
              <Heart size={10} color={colors.white} fill={colors.white} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.line} numberOfLines={2}>
              {line}
            </Text>
            <Text style={styles.when}>
              {r.direction === "sent" ? `${name} · ` : ""}
              {formatListTime(r.created_at)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => message(r, name)}
          style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Message ${name}`}
        >
          <MessageCircle size={15} color={colors.onAccent} />
          <Text style={styles.msgText}>Message</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {received.length ? (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>Hearts</Text>
            <Text style={styles.hint}>They hearted yours. Say hi.</Text>
          </View>
          {received.slice(0, SHOWN).map(renderRow)}
          {received.length > SHOWN ? (
            <Text style={styles.more}>
              and {received.length - SHOWN} more
            </Text>
          ) : null}
        </>
      ) : null}
      {sent.length ? (
        <Pressable onPress={() => setShowSent((v) => !v)} hitSlop={8}>
          <Text style={styles.toggle}>
            {showSent ? "Hide what you hearted" : `What you hearted (${sent.length})`}
          </Text>
        </Pressable>
      ) : null}
      {showSent ? sent.slice(0, SHOWN).map(renderRow) : null}
      {showSent && sent.length > SHOWN ? (
        <Text style={styles.more}>and {sent.length - SHOWN} more</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  more: { ...typography.caption, color: colors.textSecondary, paddingVertical: 6 },
  wrap: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { ...typography.eyebrow, color: colors.textSecondary },
  hint: { ...typography.micro, color: colors.textTertiary, marginLeft: "auto" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  heartBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { ...typography.caption, color: colors.text },
  when: { ...typography.micro, color: colors.textTertiary, marginTop: 1 },
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
  toggle: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText, paddingVertical: 4 },
});
