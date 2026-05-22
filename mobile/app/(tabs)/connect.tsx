import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Heart, Plus, Search, X } from "lucide-react-native";

import { SwipeCard, type SwipeDir } from "@/components/SwipeCard";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import {
  checkAndCreateMatch,
  getFeedPosts,
  recordSwipe,
  type PostWithCreator,
} from "@/lib/db";

export default function ConnectScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();

  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [swiping, setSwiping] = useState(false);
  const [pendingButtonSwipe, setPendingButtonSwipe] = useState<SwipeDir | null>(null);
  const [matchToast, setMatchToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: err } = await getFeedPosts(userId);
    if (err) setError(err);
    else if (data) {
      setPosts(data);
      setIndex(0);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Refresh whenever returning to this tab — picks up newly created posts.
      if (!loading) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  useEffect(() => {
    setIndex(0);
  }, [search]);

  const filtered = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.location?.toLowerCase().includes(q) ?? false) ||
        (p.compensation?.toLowerCase().includes(q) ?? false) ||
        (p.looking_for?.some((lf) => lf.toLowerCase().includes(q)) ?? false) ||
        p.creator.name.toLowerCase().includes(q) ||
        (p.creator.role?.toLowerCase().includes(q) ?? false)
    );
  }, [posts, search]);

  const current = filtered[index];

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const handleSwipe = useCallback(
    async (dir: SwipeDir) => {
      if (!userId || !current || swiping) return;
      setSwiping(true);
      setError(null);

      const post = current;
      const { error: swErr } = await recordSwipe(userId, post.id, dir);
      if (swErr) {
        setError(swErr);
        setSwiping(false);
        return;
      }

      if (dir === "right") {
        const { match, error: matchErr } = await checkAndCreateMatch(userId, post.id);
        if (matchErr) setError(matchErr);
        if (match) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refreshMatches();
          setMatchToast(`You matched with ${post.creator.name}!`);
          setTimeout(() => setMatchToast(null), 2800);
        }
      }

      advance();
      setSwiping(false);
    },
    [userId, current, swiping, refreshMatches, advance]
  );

  return (
    <View style={styles.root}>
      {matchToast ? (
        <View style={styles.toast}>
          <Heart size={16} color={colors.white} fill={colors.white} />
          <Text style={styles.toastText}>{matchToast}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Filter by role, location, skill..."
            containerStyle={{ flex: 1 }}
            style={styles.searchInput}
            leading={<Search size={16} color={colors.textSubtle} />}
            trailing={
              search ? (
                <Pressable hitSlop={8} onPress={() => setSearch("")}>
                  <X size={16} color={colors.textSubtle} />
                </Pressable>
              ) : null
            }
            autoCapitalize="none"
          />
          <Pressable
            style={styles.newPostBtn}
            onPress={() => router.push("/post/new")}
            accessibilityLabel="New post"
          >
            <Plus size={14} color={colors.brandText} />
            <Text style={styles.newPostText}>New Post</Text>
          </Pressable>
        </View>

        <ErrorBanner message={error} />

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : !current ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {search ? "No posts match your filter." : "No new posts to swipe on."}
            </Text>
            <Text style={styles.emptyBody}>
              {search
                ? "Try a different search term."
                : "Pull to refresh, or post one of your own so others can find you."}
            </Text>
            {search ? (
              <Pressable onPress={() => setSearch("")}>
                <Text style={styles.emptyLink}>Clear filter</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/post/new")}
                style={styles.emptyCta}
              >
                <Plus size={14} color={colors.white} />
                <Text style={styles.emptyCtaText}>Create a post</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.deck}>
            <SwipeCard
              key={current.id}
              post={current}
              disabled={swiping}
              pendingButtonSwipe={pendingButtonSwipe}
              onButtonSwipeComplete={() => setPendingButtonSwipe(null)}
              onSwipe={handleSwipe}
              onOpenDetails={() =>
                router.push({ pathname: "/post/[id]", params: { id: current.id } })
              }
            />

            <Text style={styles.remaining}>
              {filtered.length - index - 1} posts remaining
              {search ? " (filtered)" : ""}
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.passBtn]}
                onPress={() => setPendingButtonSwipe("left")}
                disabled={swiping}
              >
                <X size={20} color={colors.dangerText} />
                <Text style={styles.passText}>Pass</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.likeBtn]}
                onPress={() => setPendingButtonSwipe("right")}
                disabled={swiping}
              >
                <Heart size={20} color={colors.white} />
                <Text style={styles.likeText}>Like</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.pill },
  newPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  newPostText: { color: colors.brandText, fontWeight: "700", fontSize: 13 },
  deck: { gap: 12 },
  remaining: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
    minWidth: 130,
    justifyContent: "center",
  },
  passBtn: {
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  passText: { color: colors.dangerText, fontWeight: "700", fontSize: 14 },
  likeBtn: { backgroundColor: colors.like },
  likeText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  empty: { paddingVertical: 64, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  emptyBody: { color: colors.textSubtle, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  emptyLink: { color: colors.brandText, fontSize: 13, fontWeight: "700", marginTop: 4 },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    marginTop: 8,
  },
  emptyCtaText: { color: colors.white, fontWeight: "700" },
  toast: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: colors.like,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: { color: colors.white, fontWeight: "700" },
});
