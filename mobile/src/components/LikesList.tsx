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

  const load = useCallback(async () => {
    const { data } = await getMyLikes();
    setRows(data);
    const ids = [...new Set(data.map((r) => r.other_user))];
    if (!ids.length) return;
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id,name,role,avatar_url")
      .in("user_id", ids);
    setPeople(new Map(((profs || []) as Person[]).map((p) => [p.user_id, p])));
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const received = rows.filter((r) => r.direction === "received");
  const sent = rows.filter((r) => r.direction === "sent");
  if (!received.length && !sent.length) return null;

  const message = (r: LikeRow, name: string) => {
    const thread = matches.find((m) => m.other_user_id === r.other_user);
    if (thread) {
      router.push({ pathname: "/chat/[matchId]", params: { matchId: thread.id } });
      return;
    }
    router.push({
      pathname: "/message/[userId]",
      params: {
        userId: r.other_user,
        origin: r.kind,
        originId: r.target_id,
        about: r.title ?? (r.kind === "profile" ? `${name}'s profile` : undefined),
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
    </View>
  );
}

const styles = StyleSheet.create({
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
