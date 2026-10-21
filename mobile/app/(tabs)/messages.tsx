import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, CheckCheck } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { ScreenTitle } from "@/components/ScreenTitle";
import { LikesList } from "@/components/LikesList";
import { PushPrimer } from "@/components/PushPrimer";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MatchRowSkeleton } from "@/components/ui/Skeleton";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useBarTop } from "./_layout";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { isLastMessageSeen, isMatchUnread, type MatchWithPost } from "@/lib/db";
import { formatListTime } from "@/lib/format";

/** When a thread last moved: its last message, or the match itself if nobody has written. */
function lastActivity(m: MatchWithPost): string {
  return m.last_message?.created_at ?? m.created_at;
}

/**
 * Messages.
 *
 * Faces of people who hearted you along the top; under them, every
 * conversation in one list, newest first. It used to split "new" matches into
 * their own row and group the rest under project headers, which made a tab
 * with four threads look like a filing system. Who and how recently is what
 * people scan an inbox for, so that is all a row says. Report and Unmatch
 * stay on a long press rather than becoming buttons on every row.
 */
export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const router = useRouter();
  const { userId } = useAuth();
  const { matches, loading, error, refresh, unmatch } = useMatches();
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [likesReload, setLikesReload] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLikesReload((k) => k + 1);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const threads = useMemo(
    () => [...matches].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
    [matches]
  );

  const confirmUnmatch = useCallback(
    (match: MatchWithPost) => {
      Alert.alert(
        (match.origin ?? "swipe") === "swipe"
          ? `Unmatch ${match.other_creator.name}?`
          : `Delete the conversation with ${match.other_creator.name}?`,
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
          router.push({ pathname: "/profile/[userId]", params: { userId: match.other_user_id } });
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
            options: ["View profile", "Report", "Unmatch", "Cancel"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 3,
          },
          (i) => {
            if (i < 3) run(i);
          }
        );
      } else {
        Alert.alert(match.other_creator.name, undefined, [
          { text: "View profile", onPress: () => run(0) },
          { text: "Report", onPress: () => run(1) },
          { text: "Unmatch", style: "destructive", onPress: () => run(2) },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    },
    [router, confirmUnmatch]
  );

  if (loading && matches.length === 0) {
    return (
      <View style={[styles.list, { paddingTop: insets.top + spacing.sm, gap: 10 }]}>
        <MatchRowSkeleton />
        <MatchRowSkeleton />
        <MatchRowSkeleton />
      </View>
    );
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(m) => m.id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.sm, paddingBottom: barTop + 24 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle title="Messages" />
          {/* One banner at most: a load failure outranks a failed unmatch. */}
          <ErrorBanner message={error || actionError} />
          <LikesList reloadKey={likesReload} />
          {/* Asked here rather than at launch, where a "Don't Allow" is
              permanent before anyone has a reason to say yes. */}
          {userId && matches.length ? <PushPrimer userId={userId} /> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>
            When someone you liked likes you back, the chat opens here. You can also message anyone
            from their profile, their work, or an event you both went to.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <ThreadRow
          match={item}
          currentUserId={userId}
          onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } })}
          onLongPress={() => openRowMenu(item)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function ThreadRow({
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
  const mine = !!match.last_message && match.last_message.sender_id === currentUserId;
  const seen = currentUserId ? isLastMessageSeen(match, currentUserId) : false;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${match.other_creator.name}${unread ? ", unread" : ""}`}
      accessibilityHint="Long press for profile, report or unmatch"
    >
      <Avatar creator={match.other_creator} size="lg" />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {match.other_creator.name}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {formatListTime(lastActivity(match))}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          {mine ? (
            seen ? (
              <CheckCheck size={13} color={colors.accentInk} />
            ) : (
              <Check size={13} color={colors.iconFaint} />
            )
          ) : null}
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {match.last_message?.content ?? "Say hi."}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.xs },

  /* Plain rows on the ground with a hairline between them — the iOS list
     idiom. The whole row is the one target. */
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 60 },
  rowText: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { ...typography.bodyStrong, flex: 1, color: colors.text },
  time: { ...typography.micro, color: colors.textSecondary },
  timeUnread: { color: colors.text, fontFamily: fonts.semibold },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  preview: { flex: 1, ...typography.caption, color: colors.textSecondary },
  previewUnread: { color: colors.text, fontFamily: fonts.semibold },
  unreadDot: { width: 9, height: 9, borderRadius: radii.pill, backgroundColor: colors.accent },

  empty: { gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.display2 },
  emptyBody: { ...typography.body, color: colors.textSecondary, maxWidth: 340 },
});
