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
import { Check, CheckCheck, MessageSquarePlus, Search, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { PushPrimer } from "@/components/PushPrimer";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MatchRowSkeleton } from "@/components/ui/Skeleton";
import { colors, radii, shadows } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { isLastMessageSeen, isMatchUnread, type MatchWithPost } from "@/lib/db";
import { formatListTime } from "@/lib/format";

/**
 * Messages.
 *
 * Previously one flat list where a brand-new match and a months-old thread
 * looked identical, and the only thing on screen was a stack of grey cards.
 * Now it splits the two states that actually behave differently:
 *
 *   - New matches (nobody has said anything yet) go in a horizontal row at the
 *     top. They're the ones that need an action, and a row of faces reads as an
 *     invitation in a way a list row doesn't.
 *   - Conversations go below, newest first, with the timestamp and unread count
 *     on the right where the eye already scans, and a "Seen" marker so you know
 *     whether your last message landed.
 *
 * Long-pressing a row gives you unmatch, which the app previously had no way to
 * do at all — blocking was the only exit from a match.
 */

export default function MessagesScreen() {
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

  const { newMatches, conversations } = useMemo(() => {
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
    return { newMatches: fresh, conversations: talking };
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
    (matchId: string) =>
      router.push({ pathname: "/chat/[matchId]", params: { matchId } }),
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

  // Nothing at all — a different problem from "no search results", and it
  // deserves a route out rather than an apology.
  if (matches.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyScroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {error ? <ErrorBanner message={error} /> : null}
        <View style={styles.emptyIcon}>
          <MessageSquarePlus size={30} color={colors.brandText} />
        </View>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyBody}>
          When you and another creative both like each other&apos;s posts, the conversation opens
          up here.
        </Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.push("/(tabs)/connect")}>
          <Text style={styles.emptyBtnText}>Start swiping</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorBanner message={error} /> : null}
          {actionError ? <ErrorBanner message={actionError} /> : null}

          {/* Asked here rather than at launch: by the time someone is on this
              screen they have matches, which is the thing being offered. */}
          {userId ? <PushPrimer userId={userId} /> : null}

          {/* The filter only earns its space once the list is long enough to
              need it — below that it is one more thing to look past. */}
          {matches.length > 4 ? (
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search matches and messages"
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
                <Text style={styles.sectionTitle}>New matches</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{newMatches.length}</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.newRow}
              >
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
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {conversations.length > 0 ? (
            <Text style={[styles.sectionTitle, styles.convHead]}>Conversations</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.inlineEmpty}>
          <Text style={styles.inlineEmptyText}>
            {query.trim()
              ? "Nothing matches that search."
              : newMatches.length > 0
                ? "No conversations yet — say hello to one of your new matches above."
                : "No conversations yet."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <MatchRow
          match={item}
          currentUserId={userId}
          onPress={() => openChat(item.id)}
          onLongPress={() => openRowMenu(item)}
        />
      )}
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
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${match.other_creator.name}${unread ? ", unread" : ""}`}
    >
      <Avatar creator={match.other_creator} size="lg" />

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
            {match.other_creator.name}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {match.last_message
              ? formatListTime(match.last_message.created_at)
              : formatListTime(match.created_at)}
          </Text>
        </View>

        <View style={styles.rowBottom}>
          {/* Sent/seen only ever shows on your own last message — there's
              nothing meaningful to say about the state of theirs. */}
          {mine ? (
            seen ? (
              <CheckCheck size={13} color={colors.brandText} />
            ) : (
              <Check size={13} color={colors.textSubtle} />
            )
          ) : null}
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {match.last_message?.content ?? "Say hello — nobody's spoken yet."}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>

        <Text style={styles.context} numberOfLines={1}>
          {match.other_creator.role ? `${match.other_creator.role} · ` : ""}
          {match.other_post.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingTop: 12, flexGrow: 1 },
  header: { gap: 12 },

  section: { gap: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  convHead: { marginTop: 4 },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    backgroundColor: colors.brandTabBg,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { color: colors.white, fontSize: 11, fontWeight: "800" },

  newRow: { gap: 14, paddingVertical: 2, paddingRight: 8 },
  newItem: { alignItems: "center", width: 68, gap: 6 },
  newRing: {
    padding: 2.5,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentMuted,
  },
  newName: { fontSize: 11, fontWeight: "600", color: colors.textMuted, maxWidth: 66 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...shadows.soft,
  },
  separator: { height: 8 },
  rowText: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  nameUnread: { fontWeight: "800" },
  time: { color: colors.textSubtle, fontSize: 11 },
  timeUnread: { color: colors.brandText, fontWeight: "700" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  preview: { flex: 1, color: colors.textMuted, fontSize: 13 },
  previewUnread: { color: colors.text, fontWeight: "600" },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brandTabBg,
  },
  context: { color: colors.textSubtle, fontSize: 11 },

  inlineEmpty: { paddingVertical: 28, alignItems: "center" },
  inlineEmptyText: { color: colors.textSubtle, fontSize: 13, textAlign: "center" },

  emptyScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
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
  emptyBtnText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
