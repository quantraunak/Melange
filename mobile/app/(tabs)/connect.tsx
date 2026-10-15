import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, Search, X } from "lucide-react-native";

import { MatchCelebration } from "@/components/MatchCelebration";
import { SwipeCard, SwipeCardBehind, type SwipeDir } from "@/components/SwipeCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Glass } from "@/components/ui/Glass";
import { Input } from "@/components/ui/Input";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { PushPrimer } from "@/components/PushPrimer";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { colors, fonts, GUTTER, motion, radii, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useMatches } from "@/lib/matches";
import { trackEvent } from "@/lib/analytics";
import { useBarTop } from "./_layout";
import {
  checkAndCreateMatch,
  getExplorePosts,
  getFeedPosts,
  getProfile,
  profileGate,
  recordSwipe,
  projectRoles,
  undoSwipe,
  type CreatorInfo,
  type PostWithCreator,
  type Profile,
} from "@/lib/db";
import { likeProject } from "@/lib/likeProject";

const { width: SCREEN_W } = Dimensions.get("window");

/** Set the first time someone likes a project. See hasLiked. */
const LIKED_KEY = "melange.hasLiked.v1";

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId } = useAuth();
  const { refresh: refreshMatches } = useMatches();
  /** Owned here so the card behind can follow the front card's drag. */
  const tx = useSharedValue(0);

  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  /**
   * How many active projects exist that this person did not write, regardless
   * of whether they have swiped them.
   *
   * Without this the deck cannot tell "nobody has posted anything" from "you
   * have seen all of them", and it showed the first message in both cases.
   * With ten projects in the whole app, everyone who actually used Discover
   * swiped through all of them and was then told, falsely, that there were no
   * open collabs and that they should post a project they had already posted.
   */
  const [catalogueSize, setCatalogueSize] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [pendingButtonSwipe, setPendingButtonSwipe] = useState<SwipeDir | null>(null);
  /**
   * Whether this person has ever liked anything, which is when the offer of a
   * notification is worth making. See the slot at the bottom of the screen.
   */
  const [hasLiked, setHasLiked] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(LIKED_KEY)
      .then((v) => setHasLiked(v === "1"))
      .catch(() => {});
  }, []);

  const [celebration, setCelebration] = useState<
    { creator: CreatorInfo; matchId: string; projectTitle: string } | null
  >(null);
  const [me, setMe] = useState<Pick<CreatorInfo, "name" | "avatar_url">>({
    name: "You",
    avatar_url: null,
  });
  /** Kept whole because the gate reads role and portfolio, not just a name. */
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [gateLine, setGateLine] = useState<string | null>(null);

  const [lastSwipe, setLastSwipe] = useState<{ post: PostWithCreator; dir: SwipeDir } | null>(null);
  const [rewinding, setRewinding] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    // Counted separately from the deck, which excludes anything already swiped.
    getExplorePosts(userId)
      .then(({ data: all }) => setCatalogueSize(all ? all.length : null))
      .catch(() => {});

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
      if (!data) return;
      setMe({ name: data.name, avatar_url: data.avatar_url ?? null });
      setMyProfile(data);
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

  /**
   * Advance first, then talk to the server.
   *
   * The card used to sit off-screen while two round-trips completed, leaving
   * the user staring at a dimmed back card with no spinner. On failure we
   * roll the index back and say so.
   */
  const handleSwipe = useCallback(
    async (dir: SwipeDir) => {
      if (!userId || !current || swiping) return;
      const post = current;

      /* A left swipe costs the other person nothing, so it is never gated.
         A right swipe asks for their attention, and that is what has a price. */
      if (dir === "right") {
        const gate = profileGate(myProfile, "like");
        if (!gate.ok) {
          setGateLine(gate.line);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          return;
        }
      }
      setGateLine(null);

      setSwiping(true);
      setError(null);
      setIndex((i) => i + 1);
      setLastSwipe({ post, dir });
      tx.value = 0;

      /**
       * Right swipes go through likeProject, which is also what the Browse
       * heart and post detail call — the deck's gate and their missing one
       * were the divergence, and one shared write is what stops it coming
       * back. The synchronous check above stays because it has to answer
       * before the card leaves the screen.
       */
      let swErr: string | null = null;
      if (dir === "right") {
        const outcome = await likeProject({
          userId,
          postId: post.id,
          profile: myProfile,
          // The deck never serves a project this person has swiped, so any
          // existing row was written on another surface since it loaded;
          // likeProject reads the row itself in that case.
          passed: false,
        });
        if (outcome.status === "blocked") {
          setIndex((i) => Math.max(0, i - 1));
          setLastSwipe(null);
          setGateLine(outcome.line);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          setSwiping(false);
          return;
        }
        if (outcome.status === "failed") swErr = outcome.message;
      } else {
        swErr = (await recordSwipe(userId, post.id, "left")).error;
      }
      if (swErr) {
        setIndex((i) => Math.max(0, i - 1));
        setLastSwipe(null);
        setError(swErr);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setSwiping(false);
        return;
      }

      trackEvent(dir === "right" ? "swipe_right" : "swipe_left", {
        post_id: post.id,
        owner_id: post.owner_id,
      });

      if (dir === "right") {
        // The moment asking about notifications makes sense: they have just
        // said they want something, and the answer arrives later or not at all.
        setHasLiked(true);
        AsyncStorage.setItem(LIKED_KEY, "1").catch(() => {});
        const { match, error: matchErr } = await checkAndCreateMatch(userId, post.id);
        if (matchErr) setError(matchErr);
        if (match) {
          trackEvent("match_created", { match_id: match.id, post_id: post.id });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refreshMatches();
          setCelebration({ creator: post.creator, matchId: match.id, projectTitle: post.title });
        }
      }

      setSwiping(false);
    },
    [userId, current, swiping, refreshMatches, tx, myProfile]
  );

  const rewind = useCallback(async () => {
    if (!lastSwipe || rewinding || swiping) return;
    // Before the await: an undo buzz that lands after the round-trip is lag.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRewinding(true);
    setError(null);

    const { error: undoErr } = await undoSwipe(lastSwipe.post.id);
    if (undoErr) {
      setError(undoErr);
      setLastSwipe(null);
      setRewinding(false);
      return;
    }

    trackEvent("swipe_undo", { post_id: lastSwipe.post.id });
    // Fly the card back in from the edge it left by, rather than fading it in.
    tx.value = lastSwipe.dir === "right" ? SCREEN_W * 1.25 : -SCREEN_W * 1.25;
    setIndex((i) => Math.max(0, i - 1));
    tx.value = withSpring(0, motion.springs.promote);
    setLastSwipe(null);
    setRewinding(false);
  }, [lastSwipe, rewinding, swiping, tx]);

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
          <View style={[styles.centered, { paddingBottom: barTop + GUTTER }]}>
            <Glass style={styles.empty} elevated>
              {search ? (
                <>
                  <Text style={styles.emptyTitle}>No projects match that.</Text>
                  <Text style={styles.emptyBody}>Try a role or a city instead.</Text>
                  <Pressable onPress={() => setSearch("")}>
                    <Text style={styles.emptyLink}>Clear filter</Text>
                  </Pressable>
                </>
              ) : catalogueSize && catalogueSize > 0 ? (
                <>
                  <Text style={styles.emptyTitle}>You&apos;re all caught up.</Text>
                  <Text style={styles.emptyBody}>
                    You&apos;ve seen every open project for now. New ones show up here.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/stories")}
                    style={styles.emptyCta}
                  >
                    <Text style={styles.emptyCtaText}>Browse everything</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No open collabs right now.</Text>
                  <Text style={styles.emptyBody}>
                    Post your own project so people can find you.
                  </Text>
                  <Pressable onPress={() => router.push("/post/new")} style={styles.emptyCta}>
                    <Plus size={14} color={colors.onBrand} />
                    <Text style={styles.emptyCtaText}>Post a project</Text>
                  </Pressable>
                </>
              )}
            </Glass>
          </View>
        ) : (
          <>
            {filtered[index + 1] ? (
              <SwipeCardBehind post={filtered[index + 1]} tx={tx} barTop={barTop} />
            ) : null}
            <SwipeCard
              key={current.id}
              post={current}
              disabled={swiping}
              topInset={topInset}
              barTop={barTop}
              tx={tx}
              canUndo={!!lastSwipe && !rewinding}
              onPass={() => setPendingButtonSwipe("left")}
              onLike={() => setPendingButtonSwipe("right")}
              onUndo={rewind}
              pendingButtonSwipe={pendingButtonSwipe}
              onButtonSwipeComplete={() => setPendingButtonSwipe(null)}
              onSwipe={handleSwipe}
              onOpenCreator={
                current.creator.user_id
                  ? () =>
                      router.push({
                        pathname: "/profile/[userId]",
                        params: { userId: current.creator.user_id as string },
                      })
                  : undefined
              }
              onOpenDetails={() =>
                router.push({ pathname: "/post/[id]", params: { id: current.id } })
              }
            />
          </>
        )}
      </View>

      {/* Floating controls: search and post, top right. Sit below the image
          segments so the two bands never overlap. */}
      <View style={[styles.topControls, { top: topInset + 26 }]} pointerEvents="box-none">
        {searchOpen ? (
          <Glass variant="strong" radius={radii.pill} elevated style={styles.searchWrap}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Role, city, title…"
              autoFocus
              autoCapitalize="none"
              leading={<Search size={16} color={colors.iconFaint} />}
              trailing={
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                >
                  <X size={16} color={colors.iconFaint} />
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
              size={44}
            >
              <Search size={18} color={colors.text} strokeWidth={1.75} />
            </GlassButton>
            <GlassButton
              accessibilityLabel="Post a project"
              onPress={() => router.push("/post/new")}
              size={44}
            >
              <Plus size={20} color={colors.brand} strokeWidth={1.75} />
            </GlassButton>
          </>
        )}
      </View>

      <View style={[styles.errorSlot, { top: topInset + 76 }]} pointerEvents="box-none">
        <ErrorBanner message={error} />
      </View>

      {/* One line at the point of the action, not a meter somewhere else. */}
      {gateLine ? (
        <View style={[styles.gateSlot, { bottom: barTop + GUTTER }]} pointerEvents="box-none">
          <Glass style={styles.gate} elevated>
            <Text style={styles.gateLine}>{gateLine}</Text>
            <Pressable onPress={() => router.push("/account/edit-profile")} hitSlop={10}>
              <Text style={styles.gateAction}>Edit profile</Text>
            </Pressable>
          </Glass>
        </View>
      ) : hasLiked && userId ? (
        /**
         * Notifications are offered here, not only on Messages.
         *
         * The only ask used to live in the Messages list header, with the
         * reasoning that by then you have matches. But you have no reason to
         * open Messages until you already have one, and the notification worth
         * having is the one telling you that you just got your first. So the
         * ask was unreachable exactly when it mattered: of twelve accounts,
         * ten had never registered a device and could not be notified of
         * anything, including the owner.
         */
        <View style={[styles.gateSlot, { bottom: barTop + GUTTER }]} pointerEvents="box-none">
          <PushPrimer userId={userId} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  gateSlot: { position: "absolute", left: GUTTER, right: GUTTER },
  gate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gateLine: { ...typography.bodyStrong, flex: 1, color: colors.text },
  gateAction: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
  deck: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  topControls: {
    position: "absolute",
    right: GUTTER,
    left: GUTTER,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  searchWrap: { flex: 1, paddingHorizontal: 4 },
  searchInput: { borderWidth: 0, backgroundColor: "transparent" },

  errorSlot: { position: "absolute", left: GUTTER, right: GUTTER },

  empty: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyTitle: { ...typography.headline, textAlign: "center" },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  emptyLink: { ...typography.caption, fontFamily: "Inter_600SemiBold", color: colors.brandText, marginTop: 4 },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: GUTTER,
    paddingVertical: 12,
    borderRadius: radii.sm,
    marginTop: 8,
  },
  emptyCtaText: { ...typography.bodyStrong, color: colors.onBrand },
});
