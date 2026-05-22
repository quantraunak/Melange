import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/Avatar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { isMatchUnread, type MatchWithPost } from "@/lib/db";
import { formatTimeAgo } from "@/lib/format";

export default function MessagesScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { matches, loading, error, refresh } = useMatches();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <View style={styles.root}>
      {error ? <View style={{ padding: 16 }}><ErrorBanner message={error} /></View> : null}

      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matches yet.</Text>
              <Text style={styles.emptyBody}>Start swiping to find collaborators.</Text>
              <Pressable onPress={() => router.push("/(tabs)/connect")}>
                <Text style={styles.emptyLink}>Go to Connect</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            currentUserId={userId}
            onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

function MatchRow({
  match,
  currentUserId,
  onPress,
}: {
  match: MatchWithPost;
  currentUserId: string | null;
  onPress: () => void;
}) {
  const unread = currentUserId ? isMatchUnread(match, currentUserId) : false;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View>
        <Avatar creator={match.other_creator} size="md" />
        {unread ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowHeader}>
          <Text style={[styles.name, unread && { fontWeight: "800" }]} numberOfLines={1}>
            {match.other_creator.name}
          </Text>
          {match.other_creator.role ? (
            <Text style={styles.role} numberOfLines={1}>
              · {match.other_creator.role}
            </Text>
          ) : null}
        </View>
        {match.last_message ? (
          <Text style={[styles.preview, unread && { color: colors.text, fontWeight: "600" }]} numberOfLines={1}>
            {match.last_message.sender_id === currentUserId ? "You: " : ""}
            {match.last_message.content}
          </Text>
        ) : (
          <Text style={styles.previewEmpty}>No messages yet — say hello.</Text>
        )}
        <Text style={styles.time}>
          {match.last_message
            ? formatTimeAgo(match.last_message.created_at)
            : `Matched ${new Date(match.created_at).toLocaleDateString()}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, paddingTop: 12, flexGrow: 1 },
  empty: { paddingVertical: 72, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  emptyBody: { color: colors.textSubtle, fontSize: 13 },
  emptyLink: { color: colors.brandText, fontWeight: "700", marginTop: 8 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
  },
  rowUnread: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brandTabBg,
    borderColor: colors.card,
    borderWidth: 2,
  },
  rowText: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  role: { color: colors.textSubtle, fontSize: 11, flexShrink: 1 },
  preview: { color: colors.textMuted, fontSize: 12 },
  previewEmpty: { color: colors.textSubtle, fontSize: 12, fontStyle: "italic" },
  time: { color: colors.textSubtle, fontSize: 11 },
});
