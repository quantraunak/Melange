import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, Heart, MapPin, Search, SlidersHorizontal, X } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, fonts, GUTTER, radii, shadows, typography, inputText } from "@/lib/theme";
import { trackEvent } from "@/lib/analytics";
import {
  checkAndCreateMatch,
  getExplorePosts,
  getMySwipes,
  projectRoles,
  recordSwipe,
  type PostWithCreator,
} from "@/lib/db";

/**
 * Browse — the Explore tab's first half.
 *
 * This used to be a plain vertical list of the same collab posts the Connect
 * deck serves, which made it read as a duplicate of the feed with none of the
 * deck's payoff. What actually distinguishes browsing from swiping is that you
 * get to *compare*: see many at once, narrow them down, and act out of order.
 *
 * So: a two-column grid, filters the deck has no room for (paid work, location,
 * hiding what you've already ruled out), and a like button on each tile that
 * runs the same swipe-and-match path the deck does. Posts you've already
 * swiped stay visible and get labelled, because "you passed on this" is useful
 * information — it's what stops the grid feeling like the feed served twice.
 */

const H_PADDING = 16;
const COLUMN_WIDTH =
  (Dimensions.get("window").width - H_PADDING * 2 - GUTTER) / 2;

type PayFilter = "all" | "paid" | "unpaid";

/** Compensation is free text, so this is a heuristic, not a field. */
function isPaid(compensation: string | null): boolean {
  if (!compensation) return false;
  const c = compensation.toLowerCase();
  if (/\b(tfp|unpaid|trade|no pay|free|collab only)\b/.test(c)) return false;
  return /[$€£\d]/.test(c) || /\b(paid|rate|budget|hourly|day rate)\b/.test(c);
}

export function BrowseGrid({ userId }: { userId: string }) {
  const router = useRouter();

  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [swipes, setSwipes] = useState<Map<string, "left" | "right">>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pay, setPay] = useState<PayFilter>("all");
  const [hideSeen, setHideSeen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [{ data, error: err }, { data: swipeMap }] = await Promise.all([
      getExplorePosts(userId),
      getMySwipes(userId),
    ]);
    if (err) setError(err);
    setPosts(data || []);
    setSwipes(swipeMap);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (hideSeen && swipes.has(p.id)) return false;
      if (pay === "paid" && !isPaid(p.compensation)) return false;
      if (pay === "unpaid" && isPaid(p.compensation)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.location?.toLowerCase().includes(q) ?? false) ||
        (p.looking_for?.some((lf) => lf.toLowerCase().includes(q)) ?? false) ||
        p.creator.name.toLowerCase().includes(q) ||
        (p.creator.role?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [posts, query, pay, hideSeen, swipes]);

  const like = useCallback(
    async (post: PostWithCreator) => {
      if (likingId) return;
      setLikingId(post.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { error: swErr } = await recordSwipe(userId, post.id, "right");
      if (swErr) {
        setError(swErr);
        setLikingId(null);
        return;
      }
      setSwipes((prev) => new Map(prev).set(post.id, "right"));
      trackEvent("swipe_right", { post_id: post.id, owner_id: post.owner_id, source: "browse" });

      const { match, error: matchErr } = await checkAndCreateMatch(userId, post.id);
      if (matchErr) setError(matchErr);
      if (match) {
        trackEvent("match_created", { match_id: match.id, post_id: post.id });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({ pathname: "/chat/[matchId]", params: { matchId: match.id } });
      }
      setLikingId(null);
    },
    [userId, likingId, router]
  );

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.tile}>
            <Skeleton height={COLUMN_WIDTH} radius={0} />
            <View style={styles.tileBody}>
              <Skeleton width="80%" height={12} />
              <Skeleton width="50%" height={10} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  const filtersActive = pay !== "all" || hideSeen;

  return (
    <View style={{ gap: 12 }}>
      <OpenCollabsStrip posts={posts} onOpen={(id) => router.push({ pathname: "/post/[id]", params: { id } })} />

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.iconFaint} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search projects, roles, cities…"
            placeholderTextColor={colors.textTertiary}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={styles.searchClear}>
              <X size={15} color={colors.iconFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setFiltersOpen((v) => !v)}
          style={[styles.filterBtn, (filtersOpen || filtersActive) && styles.filterBtnOn]}
          accessibilityLabel="Filters"
        >
          <SlidersHorizontal
            size={17}
            color={filtersOpen || filtersActive ? colors.white : colors.textSecondary}
          />
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filters}>
          <View style={styles.chipRow}>
            {(["all", "paid", "unpaid"] as PayFilter[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setPay(key)}
                style={[styles.chip, pay === key && styles.chipOn]}
              >
                <Text style={[styles.chipText, pay === key && styles.chipTextOn]}>
                  {key === "all" ? "Any pay" : key === "paid" ? "Paid" : "TFP / unpaid"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setHideSeen((v) => !v)}
            style={[styles.chip, styles.chipWide, hideSeen && styles.chipOn]}
          >
            {hideSeen ? <Check size={13} color={colors.white} /> : null}
            <Text style={[styles.chipText, hideSeen && styles.chipTextOn]}>
              Hide ones I&apos;ve already swiped
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ErrorBanner message={error} />

      <View style={styles.metaLine}>
        <Text style={styles.metaText}>
          {visible.length} {visible.length === 1 ? "project" : "projects"}
          {filtersActive || query.trim() ? " matching" : " open right now"}
        </Text>
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {posts.length === 0 ? "No open collabs yet" : "Nothing matches those filters"}
          </Text>
          <Text style={styles.emptyBody}>
            {posts.length === 0
              ? "Post a project and it shows up here for everyone else."
              : "Try widening the pay filter, or clearing the search."}
          </Text>
          {posts.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery("");
                setPay("all");
                setHideSeen(false);
              }}
              style={styles.clearAll}
            >
              <Text style={styles.clearAllText}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((post) => {
            const swiped = swipes.get(post.id);
            const thumb = post.media_urls?.[0];
            return (
              <Pressable
                key={post.id}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
                onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
              >
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Text style={styles.thumbEmptyText}>
                        {post.title.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {swiped ? (
                    <View
                      style={[
                        styles.statusPill,
                        swiped === "right" ? styles.statusLiked : styles.statusPassed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          swiped === "right" ? styles.statusTextLiked : styles.statusTextPassed,
                        ]}
                      >
                        {swiped === "right" ? "Liked" : "Passed"}
                      </Text>
                    </View>
                  ) : null}

                  {isPaid(post.compensation) ? (
                    <View style={styles.payPill}>
                      <Text style={styles.payPillText}>Paid</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.tileBody}>
                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {post.title}
                  </Text>

                  <View style={styles.creatorRow}>
                    <Avatar creator={post.creator} size="xs" />
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {post.creator.name}
                    </Text>
                  </View>

                  {post.location ? (
                    <View style={styles.locRow}>
                      <MapPin size={11} color={colors.iconFaint} />
                      <Text style={styles.locText} numberOfLines={1}>
                        {post.location}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => like(post)}
                  disabled={swiped === "right" || likingId === post.id}
                  hitSlop={6}
                  style={[
                    styles.likeBtn,
                    swiped === "right" && styles.likeBtnDone,
                    likingId === post.id && { opacity: 0.5 },
                  ]}
                  accessibilityLabel={
                    swiped === "right" ? `Already liked ${post.title}` : `Like ${post.title}`
                  }
                >
                  <Heart
                    size={15}
                    color={swiped === "right" ? colors.white : colors.accent}
                    fill={swiped === "right" ? colors.white : "transparent"}
                  />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * The newest projects, as a horizontal strip above the grid: the fastest
 * answer to "what's going on this week" before any searching or filtering.
 */
function OpenCollabsStrip({
  posts,
  onOpen,
}: {
  posts: PostWithCreator[];
  onOpen: (id: string) => void;
}) {
  const newest = useMemo(
    () => [...posts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
    [posts]
  );
  if (newest.length === 0) return null;
  return (
    <View style={styles.strip}>
      <View style={styles.stripHead}>
        <Text style={styles.stripTitle}>Open collabs this week</Text>
        <Text style={styles.stripCount}>{newest.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
        {newest.map((p) => {
          const thumb = p.media_urls?.[0];
          const role = projectRoles(p)[0];
          return (
            <Pressable
              key={p.id}
              onPress={() => onOpen(p.id)}
              style={({ pressed }) => [styles.stripCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
              accessibilityLabel={p.title}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.stripImg} />
              ) : (
                <View style={[styles.stripImg, styles.thumbEmpty]}>
                  <Text style={styles.thumbEmptyText}>{p.title.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.stripBody}>
                <Text style={styles.stripCardTitle} numberOfLines={2}>
                  {p.title}
                </Text>
                {role ? <Chip label={role} tone="accent" size="sm" style={{ alignSelf: "flex-start" }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const STRIP_W = 150;

const styles = StyleSheet.create({
  strip: { gap: 8 },
  stripHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  stripTitle: { ...typography.bodyStrong, color: colors.text },
  stripCount: { ...typography.micro, fontFamily: fonts.semibold, color: colors.accentInk, backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
  stripRow: { gap: 10, paddingRight: 4 },
  stripCard: {
    width: STRIP_W,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: "hidden",
    ...shadows.card,
  },
  stripImg: { width: STRIP_W, height: 110, backgroundColor: colors.surfaceSunken },
  stripBody: { padding: 10, gap: 6 },
  stripCardTitle: { ...typography.caption, fontFamily: fonts.semibold, color: colors.text },

  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchWrap: { flex: 1, position: "relative", justifyContent: "center" },
  searchIcon: { position: "absolute", left: 12, zIndex: 1 },
  search: { ...inputText, backgroundColor: colors.surface, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: radii.sm, paddingVertical: 11, paddingLeft: 34, paddingRight: 32, color: colors.text },
  searchClear: { position: "absolute", right: 10, zIndex: 1 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  filters: { gap: 8 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  chipWide: { alignSelf: "flex-start" },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.textSecondary },
  chipTextOn: { color: colors.white },

  metaLine: { paddingHorizontal: 2 },
  metaText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.textSecondary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GUTTER },
  tile: {
    width: COLUMN_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: "hidden",
    ...shadows.card,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", height: COLUMN_WIDTH, backgroundColor: colors.surfaceSunken },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  thumbEmptyText: { ...typography.display1, color: colors.brandText, opacity: 0.5 },

  statusPill: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusLiked: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentSoft },
  statusPassed: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  statusText: { ...typography.micro, fontFamily: fonts.semibold },
  statusTextLiked: { color: colors.accentInk },
  statusTextPassed: { color: colors.textSecondary },

  payPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: "rgba(30,58,138,0.85)",
  },
  payPillText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.white },

  tileBody: { padding: 10, gap: 5, paddingRight: 34 },
  tileTitle: { ...typography.caption, fontFamily: fonts.semibold, color: colors.text },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  creatorName: { ...typography.micro, fontFamily: fonts.semibold, flex: 1, color: colors.textSecondary },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { ...typography.micro, flex: 1, color: colors.textSecondary },

  likeBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  likeBtnDone: { backgroundColor: colors.accent, borderColor: colors.accent },

  empty: { paddingVertical: 48, alignItems: "center", gap: 6, paddingHorizontal: 24 },
  emptyTitle: { ...typography.bodyStrong, color: colors.text },
  emptyBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  clearAll: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  clearAllText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.text },
});
