import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Heart, Plus, RotateCcw, Search, X } from "lucide-react-native";

import { MatchCelebration } from "@/components/MatchCelebration";
import { SwipeCard, SwipeCardBehind, type SwipeDir } from "@/components/SwipeCard";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SwipeCardSkeleton } from "@/components/ui/Skeleton";
import { colors, radii } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { trackEvent } from "@/lib/analytics";
import {
  checkAndCreateMatch,
  getFeedPosts,
  getProfile,
  recordSwipe,
  undoSwipe,
  type CreatorInfo,
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

  // The match moment, and who it was with.
  const [celebration, setCelebration] = useState<
    { creator: CreatorInfo; matchId: string } | null
  >(null);
  const [me, setMe] = useState<Pick<CreatorInfo, "name" | "avatar_url">>({
    name: "You",
    avatar_url: null,
  });

  // The last card that left the deck, so it can be brought back.
  const [lastSwipe, setLastSwipe] = useState<{ post: PostWithCreator; dir: SwipeDir } | null>(null);
  const [rewinding, setRewinding] = useState(false);

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

  // Only needed for the two faces in the match moment; a failure here just
  // means the placeholder initial, so it stays quiet.
  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(({ data }) => {
      if (data) setMe({ name: data.name, avatar_url: data.avatar_url ?? null });
    });
  }, [userId]);

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

      trackEvent(dir === "right" ? "swipe_right" : "swipe_left", {
        post_id: post.id,
        owner_id: post.owner_id,
      });

      setLastSwipe({ post, dir });

      if (dir === "right") {
        const { match, error: matchErr } = await checkAndCreateMatch(userId, post.id);
        if (matchErr) setError(matchErr);
        if (match) {
          trackEvent("match_created", { match_id: match.id, post_id: post.id });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refreshMatches();
          setCelebration({ creator: post.creator, matchId: match.id });
        }
      }

      advance();
      setSwiping(false);
    },
    [userId, current, swiping, refreshMatches, advance]
  );

  /**
   * Put the last card back. The swipe row has to go server-side too, or the
   * feed query filters the post straight back out on the next refresh.
   */
  const rewind = useCallback(async () => {
    if (!lastSwipe || rewinding || swiping) return;
    setRewinding(true);
    setError(null);

    const { error: undoErr } = await undoSwipe(lastSwipe.post.id);
    if (undoErr) {
      setError(undoErr);
      setLastSwipe(null);
      setRewinding(false);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackEvent("swipe_undo", { post_id: lastSwipe.post.id });
    setIndex((i) => Math.max(0, i - 1));
    setLastSwipe(null);
    setRewinding(false);
  }, [lastSwipe, rewinding, swiping]);

  return (
    <View style={styles.root}>
      <MatchCelebration
        visible={!!celebration}
        me={me}
        them={celebration?.creator ?? null}
        onMessage={() => {
          const matchId = celebration?.matchId;
          setCelebration(null);
          if (matchId) router.push({ pathname: "/chat/[matchId]", params: { matchId } });
        }}
        onKeepSwiping={() => setCelebration(null)}
      />

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
          <SwipeCardSkeleton />
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
            <View style={styles.cardStack}>
              {filtered[index + 1] ? <SwipeCardBehind post={filtered[index + 1]} /> : null}
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
            </View>

            <Text style={styles.remaining}>
              {filtered.length - index - 1} posts remaining
              {search ? " (filtered)" : ""}
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.rewindBtn,
                  pressed && styles.actionBtnPressed,
                  !lastSwipe && styles.rewindBtnOff,
                ]}
                onPress={rewind}
                disabled={!lastSwipe || rewinding || swiping}
                accessibilityLabel="Undo last swipe"
              >
                <RotateCcw
                  size={18}
                  color={lastSwipe ? colors.warning : colors.textFaint}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.passBtn,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPendingButtonSwipe("left");
                }}
                disabled={swiping}
              >
                <X size={20} color={colors.dangerText} />
                <Text style={styles.passText}>Pass</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.likeBtn,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setPendingButtonSwipe("right");
                }}
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
  cardStack: { position: "relative" },
  remaining: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 4,
  },
  rewindBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  rewindBtnOff: { opacity: 0.45 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
    minWidth: 112,
    justifyContent: "center",
  },
  actionBtnPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
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
});
