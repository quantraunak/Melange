import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  getBlockedUsers,
  unblockUser,
  type CreatorInfo,
} from "@/lib/db";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [list, setList] = useState<CreatorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: err } = await getBlockedUsers(userId);
    if (err) setError(err);
    setList(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUnblock = (target: CreatorInfo) => {
    if (!userId || !target.user_id) return;
    Alert.alert(
      `Unblock ${target.name}?`,
      "They will be able to see your projects again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            const { error: err } = await unblockUser(userId, target.user_id!);
            if (err) setError(err);
            await load();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={list}
          keyExtractor={(u) => u.user_id || u.name}
          ListHeaderComponent={
            error ? <View style={{ marginBottom: 12 }}><ErrorBanner message={error} /></View> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You haven&apos;t blocked anyone.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar creator={item} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.role ? <Text style={styles.role}>{item.role}</Text> : null}
              </View>
              <Button size="sm" variant="outline" title="Unblock" onPress={() => onUnblock(item)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomColor: colors.lineStrong,
    borderBottomWidth: 1,
  },
  headerTitle: { ...typography.headline, flex: 1, textAlign: "center", color: colors.text },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, flexGrow: 1 },
  empty: { paddingVertical: 72, alignItems: "center" },
  emptyText: { color: colors.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
  },
  name: { ...typography.bodyStrong, color: colors.text },
  role: { ...typography.caption, color: colors.textSecondary },
});
