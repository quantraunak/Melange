import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Heart, Plus, RotateCcw, Search, X } from "lucide-react-native";

import { MatchCelebration } from "@/components/MatchCelebration";
import { SwipeCard, SwipeCardBehind, type SwipeDir } from "@/components/SwipeCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
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
export const TAB_BAR_CLEARANCE = 92;
/** The Like/Pass row that floats between the panel and the tab bar. */
const ACTIONS_HEIGHT = 64;
const PANEL_INSET = TAB_BAR_CLEARANCE + ACTIONS_HEIGHT + 12;

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();

  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [pendingButtonSwipe, setPendingButtonSwipe] = useState<SwipeDir | null>(null);

  const [celebration, setCelebration] = useState<
    { creator: CreatorInfo; matchId: string; projectTitle: string } | null
  >(null);
  const [me, setMe] = useState<Pick<CreatorInfo, "name" | "avatar_url">>({
    name: "You",
    avatar_url: null,
  });

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
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(({ data }) => {
      if (data) setMe({ name: data.name, avatar_url: data.avatar_url ?? null });
    });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
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

      setIndex((i) => i + 1);
      setSwiping(false);
    },
    [userId, current, swiping, refreshMatches]
  );

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

  const topInset = insets.top;

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

      {/* The deck fills the screen; everything else floats on top of it. */}
      <View style={styles.deck}>
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Loading projects…</Text>
          </View>
        ) : !current ? (
          <View style={[styles.centered, { paddingBottom: PANEL_INSET }]}>
            <Glass style={styles.empty} elevated>
              <Text style={styles.emptyTitle}>
                {search ? "No projects match that." : "No open collabs right now."}
              </Text>
              <Text style={styles.emptyBody}>
                {search
                  ? "Try a role or a city instead."
                  : "Post your own project so people can find you."}
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
          </View>
        ) : (
          <>
            {filtered[index + 1] ? (
              <SwipeCardBehind
                post={filtered[index + 1]}
                topInset={topInset}
                bottomInset={PANEL_INSET}
              />
            ) : null}
            <SwipeCard
              key={current.id}
              post={current}
              disabled={swiping}
              topInset={topInset}
              bottomInset={PANEL_INSET}
              pendingButtonSwipe={pendingButtonSwipe}
              onButtonSwipeComplete={() => setPendingButtonSwipe(null)}
              onSwipe={handleSwipe}
              onOpenDetails={() =>
                router.push({ pathname: "/post/[id]", params: { id: current.id } })
              }
            />
          </>
        )}
      </View>

      {/* Floating controls: search and post, top right. */}
      <View style={[styles.topControls, { top: topInset + 8 }]} pointerEvents="box-none">
        {searchOpen ? (
          <Glass variant="strong" radius={radii.pill} elevated style={styles.searchWrap}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Role, city, title…"
              autoFocus
              autoCapitalize="none"
              leading={<Search size={16} color={colors.textSubtle} />}
              trailing={
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                >
                  <X size={16} color={colors.textSubtle} />
                </Pressable>
              }
              containerStyle={styles.searchInput}
            />
          </Glass>
        ) : (
          <>
            <GlassButton
              accessibilityLabel="Filter projects"
              onPress={() => setSearchOpen(true)}
              size={42}
            >
              <Search size={18} color={colors.text} />
            </GlassButton>
            <GlassButton
              accessibilityLabel="Post a project"
              onPress={() => router.push("/post/new")}
              size={42}
            >
              <Plus size={20} color={colors.brandText} strokeWidth={2.5} />
            </GlassButton>
          </>
        )}
      </View>

      <View style={[styles.errorSlot, { top: topInset + 58 }]} pointerEvents="box-none">
        <ErrorBanner message={error} />
      </View>

      {/* Like / Pass, floating over the photo. */}
      {current && !loading ? (
        <View style={[styles.actions, { bottom: TAB_BAR_CLEARANCE }]} pointerEvents="box-none">
          <GlassButton
            accessibilityLabel="Undo last swipe"
            onPress={rewind}
            disabled={!lastSwipe || rewinding || swiping}
            size={48}
            style={!lastSwipe ? styles.dim : undefined}
          >
            <RotateCcw size={19} color={lastSwipe ? colors.warning : colors.textFaint} />
          </GlassButton>

          <GlassButton
            accessibilityLabel="Pass"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPendingButtonSwipe("left");
            }}
            disabled={swiping}
            size={64}
          >
            <X size={28} color={colors.passText} strokeWidth={2.75} />
          </GlassButton>

          <GlassButton
            accessibilityLabel="Like"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPendingButtonSwipe("right");
            }}
            disabled={swiping}
            size={64}
            solid={colors.like}
            style={shadows.glow}
          >
            <Heart size={28} color={colors.white} strokeWidth={2.75} />
          </GlassButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  deck: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  topControls: {
    position: "absolute",
    right: 12,
    left: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  searchWrap: { flex: 1, paddingHorizontal: 4 },
  searchInput: { borderWidth: 0, backgroundColor: "transparent" },

  errorSlot: { position: "absolute", left: 16, right: 16 },

  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  dim: { opacity: 0.5 },

  empty: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center", gap: 8 },
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
