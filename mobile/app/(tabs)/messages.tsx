import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, CheckCheck, Sparkles, Search, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { PushPrimer } from "@/components/PushPrimer";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MatchRowSkeleton } from "@/components/ui/Skeleton";
import { colors, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { isLastMessageSeen, isMatchUnread, type MatchWithPost } from "@/lib/db";
import { formatListTime } from "@/lib/format";

/** Room for the floating tab bar. */
const TAB_BAR_CLEARANCE = 112;

type Row =
  | { kind: "project"; key: string; title: string; count: number }
  | { kind: "match"; key: string; match: MatchWithPost };

/**
 * Matches.
 *
 * New matches (nobody has written yet) sit in a row of faces at the top: they
 * are the ones that need a first message. Conversations below are grouped by
 * the project they came from, because someone with three roles filling has
 * three threads that belong together, and a person on two projects wants to see
 * which is which.
 */
export default function MatchesScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { matches, loading, error, refresh, unmatch } = useMatches();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const { newMatches, rows } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? matches.filter(
          (m) =>
            m.other_creator.name.toLowerCase().includes(q) ||
            (m.other_creator.role?.toLowerCase().includes(q) ?? false) ||
            (m.last_message?.content.toLowerCase().includes(q) ?? false) ||
            m.other_post.title.toLowerCase().includes(q)
        )
      : matches;

    const fresh = matching.filter((m) => !m.last_message);
    const talking = matching
      .filter((m) => m.last_message)
      .sort((a, b) =>
        (b.last_message?.created_at ?? b.created_at).localeCompare(
          a.last_message?.created_at ?? a.created_at
        )
      );

    // Group by project, keeping groups in order of their most recent message.
    const groups = new Map<string, MatchWithPost[]>();
    for (const m of talking) {
      const key = m.other_post.title || "Untitled project";
      const list = groups.get(key);
      if (list) list.push(m);
      else groups.set(key, [m]);
    }
    const flat: Row[] = [];
    for (const [title, list] of groups) {
      flat.push({ kind: "project", key: `project-${title}`, title, count: list.length });
      for (const m of list) flat.push({ kind: "match", key: m.id, match: m });
    }
    return { newMatches: fresh, rows: flat };
  }, [matches, query]);

  const confirmUnmatch = useCallback(
    (match: MatchWithPost) => {
      Alert.alert(
        `Unmatch ${match.other_creator.name}?`,
        "This removes the match and the conversation for both of you. It can't be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unmatch",
            style: "destructive",
            onPress: async () => {
              setActionError(null);
              const { error: err } = await unmatch(match.id);
              if (err) setActionError(err);
              else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    },
    [unmatch]
  );

  const openRowMenu = useCallback(
    (match: MatchWithPost) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const run = (index: number) => {
        if (index === 0) {
          router.push({ pathname: "/chat/[matchId]", params: { matchId: match.id } });
        } else if (index === 1) {
          router.push({
            pathname: "/report/[kind]/[id]",
            params: { kind: "user", id: match.other_user_id },
          });
        } else if (index === 2) {
          confirmUnmatch(match);
        }
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: match.other_creator.name,
            options: ["Open conversation", "Report", "Unmatch", "Cancel"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 3,
          },
          (i) => {
            if (i < 3) run(i);
          }
        );
      } else {
        Alert.alert(match.other_creator.name, undefined, [
          { text: "Open conversation", onPress: () => run(0) },
          { text: "Report", onPress: () => run(1) },
          { text: "Unmatch", style: "destructive", onPress: () => run(2) },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    },
    [router, confirmUnmatch]
  );

  const openChat = useCallback(
    (matchId: string) => router.push({ pathname: "/chat/[matchId]", params: { matchId } }),
    [router]
  );

  if (loading && matches.length === 0) {
    return (
      <View style={[styles.list, { gap: 10 }]}>
        <MatchRowSkeleton />
        <MatchRowSkeleton />
        <MatchRowSkeleton />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyScroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        {error ? <ErrorBanner message={error} /> : null}
        <View style={styles.emptyIcon}>
          <Sparkles size={28} color={colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyBody}>
          When you apply to a project and they pick you too, the conversation opens here.
        </Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.push("/(tabs)/connect")}>
          <Text style={styles.emptyBtnText}>See open projects</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorBanner message={error} /> : null}
          {actionError ? <ErrorBanner message={actionError} /> : null}

          {/* Asked here rather than at launch: by the time someone is on this
              screen they have matches, which is the thing being offered. */}
          {userId ? <PushPrimer userId={userId} /> : null}

          {matches.length > 4 ? (
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search people, projects, messages"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={{ marginBottom: 4 }}
              leading={<Search size={16} color={colors.textSubtle} />}
              trailing={
                query ? (
                  <Pressable onPress={() => setQuery("")} hitSlop={8}>
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null
              }
            />
          ) : null}

          {newMatches.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>New</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{newMatches.length}</Text>
                </View>
                <Text style={styles.sectionHint}>Nobody has written yet</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newRow}>
                {newMatches.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => openChat(m.id)}
                    onLongPress={() => openRowMenu(m)}
                    style={({ pressed }) => [styles.newItem, pressed && { opacity: 0.8 }]}
                  >
                    <View style={styles.newRing}>
                      <Avatar creator={m.other_creator} size="lg" />
                    </View>
                    <Text style={styles.newName} numberOfLines={1}>
                      {m.other_creator.name.split(" ")[0]}
                    </Text>
                    <Text style={styles.newProject} numberOfLines={1}>
                      {m.other_post.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.inlineEmpty}>
          <Text style={styles.inlineEmptyText}>
            {query.trim()
              ? "Nothing matches that search."
              : newMatches.length > 0
                ? "No conversations yet. Say hi to one of your new matches above."
                : "No conversations yet."}
          </Text>
        </View>
      }
      renderItem={({ item }) =>
        item.kind === "project" ? (
          <View style={styles.projectHead}>
            <Sparkles size={14} color={colors.accentMuted} />
            <Text style={styles.projectTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.projectCount}>{item.count}</Text>
          </View>
        ) : (
          <MatchRow
            match={item.match}
            currentUserId={userId}
            onPress={() => openChat(item.match.id)}
            onLongPress={() => openRowMenu(item.match)}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function MatchRow({
  match,
  currentUserId,
  onPress,
  onLongPress,
}: {
  match: MatchWithPost;
  currentUserId: string | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const unread = currentUserId ? isMatchUnread(match, currentUserId) : false;
  const mine = match.last_message?.sender_id === currentUserId;
  const seen = currentUserId ? isLastMessageSeen(match, currentUserId) : false;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${match.other_creator.name}${unread ? ", unread" : ""}`}
    >
      <Glass radius={radii.lg} style={styles.row}>
        <Avatar creator={match.other_creator} size="lg" />

        <View style={styles.rowText}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {match.other_creator.name}
              {match.other_creator.role ? (
                <Text style={styles.role}>{`  ${match.other_creator.role}`}</Text>
              ) : null}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>
              {match.last_message
                ? formatListTime(match.last_message.created_at)
                : formatListTime(match.created_at)}
            </Text>
          </View>

          <View style={styles.rowBottom}>
            {mine ? (
              seen ? (
                <CheckCheck size={13} color={colors.accentMuted} />
              ) : (
                <Check size={13} color={colors.textSubtle} />
              )
            ) : null}
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {match.last_message?.content ?? "Say hi. Nobody has written yet."}
            </Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingTop: 6, paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 },
  header: { gap: 12, marginBottom: 4 },

  section: { gap: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: typography.eyebrow,
  sectionHint: { ...typography.tiny, marginLeft: "auto" },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { color: colors.white, fontSize: 11, fontWeight: "800" },

  newRow: { gap: 14, paddingVertical: 2, paddingRight: 8 },
  newItem: { alignItems: "center", width: 72, gap: 5 },
  newRing: {
    padding: 2.5,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  newName: { fontSize: 12, fontWeight: "700", color: colors.text, maxWidth: 70 },
  newProject: { ...typography.tiny, maxWidth: 70 },

  projectHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  projectTitle: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, letterSpacing: -0.2 },
  projectCount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  separator: { height: 8 },
  rowText: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  nameUnread: { fontWeight: "800" },
  role: { ...typography.tiny, fontWeight: "500" },
  time: { ...typography.tiny },
  timeUnread: { color: colors.accentMuted, fontWeight: "700" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  preview: { flex: 1, ...typography.small },
  previewUnread: { color: colors.text, fontWeight: "600" },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },

  inlineEmpty: { paddingVertical: 28, alignItems: "center" },
  inlineEmptyText: { ...typography.small, textAlign: "center" },

  emptyScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 10,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: typography.h2,
  emptyBody: {
    ...typography.small,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  emptyBtnText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
});
