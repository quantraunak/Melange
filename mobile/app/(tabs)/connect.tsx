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
import { SwipeCard, SwipeCardBehind, CARD_HEIGHT, type SwipeDir } from "@/components/SwipeCard";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SwipeCardSkeleton } from "@/components/ui/Skeleton";
import { colors, radii, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { trackEvent } from "@/lib/analytics";
import {
  checkAndCreateMatch,
  getFeedPosts,
  getProfile,
  recordSwipe,
  projectRoles,
  undoSwipe,
  type CreatorInfo,
  type PostWithCreator,
} from "@/lib/db";

/** Room for the floating tab bar. */
export const TAB_BAR_CLEARANCE = 112;

export default function ProjectsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();

  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [pendingButtonSwipe, setPendingButtonSwipe] = useState<SwipeDir | null>(null);

  // The match moment, and who it was with.
  const [celebration, setCelebration] = useState<
    { creator: CreatorInfo; matchId: string; projectTitle: string } | null
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
      // Refresh whenever returning to this tab — picks up newly posted projects.
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
        projectRoles(p).some((r) => r.toLowerCase().includes(q)) ||
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
          setCelebration({ creator: post.creator, matchId: match.id, projectTitle: post.title });
        }
      }

      advance();
      setSwiping(false);
    },
    [userId, current, swiping, refreshMatches, advance]
  );

  /**
   * Put the last card back. The swipe row has to go server-side too, or the
   * feed query filters the project straight back out on the next refresh.
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

  const remaining = Math.max(0, filtered.length - index);

  return (
    <View style={styles.root}>
      <MatchCelebration
        visible={!!celebration}
        me={me}
        them={celebration?.creator ?? null}
        projectTitle={celebration?.projectTitle}
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
            tintColor={colors.textMuted}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Open collabs</Text>
            <Text style={styles.heading}>
              {loading ? "Loading projects" : remaining === 1 ? "1 project" : `${remaining} projects`}
              {search ? " match" : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => setSearchOpen((v) => !v)}
            style={[styles.iconBtn, searchOpen && styles.iconBtnOn]}
            accessibilityLabel="Filter projects"
          >
            <Search size={17} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.postBtn}
            onPress={() => router.push("/post/new")}
            accessibilityLabel="Post a project"
          >
            <Plus size={15} color={colors.brandText} strokeWidth={2.5} />
            <Text style={styles.postBtnText}>New project</Text>
          </Pressable>
        </View>

        {searchOpen ? (
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Role, city, title…"
            autoFocus
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
        ) : null}

        <ErrorBanner message={error} />

        {loading ? (
          <SwipeCardSkeleton />
        ) : !current ? (
          <Glass style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {search ? "No projects match that." : "No open collabs right now."}
            </Text>
            <Text style={styles.emptyBody}>
              {search
                ? "Try a role or a city instead."
                : "Pull to refresh, or post your own project so people can find you."}
            </Text>
            {search ? (
              <Pressable onPress={() => setSearch("")}>
                <Text style={styles.emptyLink}>Clear filter</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push("/post/new")} style={styles.emptyCta}>
                <Plus size={14} color={colors.onBrand} />
                <Text style={styles.emptyCtaText}>Post a project</Text>
              </Pressable>
            )}
          </Glass>
        ) : (
          <View style={styles.deck}>
            <View style={[styles.cardStack, { height: CARD_HEIGHT }]}>
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

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.roundBtn,
                  pressed && styles.pressed,
                  !lastSwipe && styles.roundBtnOff,
                ]}
                onPress={rewind}
                disabled={!lastSwipe || rewinding || swiping}
                accessibilityLabel="Undo last swipe"
              >
                <RotateCcw size={18} color={lastSwipe ? colors.warning : colors.textFaint} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.passBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPendingButtonSwipe("left");
                }}
                disabled={swiping}
                accessibilityLabel="Pass"
              >
                <X size={20} color={colors.passText} strokeWidth={2.75} />
                <Text style={styles.passText}>Pass</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setPendingButtonSwipe("right");
                }}
                disabled={swiping}
                accessibilityLabel="Like"
              >
                <Heart size={20} color={colors.white} strokeWidth={2.75} />
                <Text style={styles.applyText}>Like</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Swipe right to like. A chat opens only when you both say yes.</Text>
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
    paddingTop: 6,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: typography.eyebrow,
  heading: { ...typography.h2, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnOn: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radii.pill,
  },
  postBtnText: { color: colors.brandText, fontWeight: "700", fontSize: 14 },
  deck: { gap: 14 },
  cardStack: { position: "relative" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 2,
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnOff: { opacity: 0.45 },
  passBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 56,
    paddingHorizontal: 26,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.pass,
    ...shadows.soft,
  },
  passText: { color: colors.passText, fontWeight: "800", fontSize: 16 },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 56,
    paddingHorizontal: 30,
    borderRadius: 28,
    backgroundColor: colors.like,
    ...shadows.glow,
  },
  applyText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  hint: { ...typography.tiny, textAlign: "center" },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyTitle: { ...typography.h3, textAlign: "center" },
  emptyBody: { ...typography.small, textAlign: "center", lineHeight: 19 },
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
  emptyCtaText: { color: colors.onBrand, fontWeight: "700" },
});
