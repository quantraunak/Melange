import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

import { FOUNDING_MARK } from "@/components/IdentityLine";
import { SceneChips } from "@/components/SceneChips";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { sized } from "@/lib/imageUrl";
import { sceneLabel, type Scene } from "@/lib/scenes";
import {
  getCurrentTheme,
  getExploreStories,
  type StoryWithAuthor,
  type WeeklyTheme,
} from "@/lib/stories";
import { colors, fonts, GUTTER, radii, spacing, typography } from "@/lib/theme";
import { useBarTop } from "./_layout";

const { width: SCREEN_W } = Dimensions.get("window");
const COL_GAP = spacing.md;
const COL_W = (SCREEN_W - GUTTER * 2 - COL_GAP) / 2;

/**
 * Tile shapes, height over width. We don't know a cover's real proportions
 * until it has downloaded, and reflowing the board as each one lands makes
 * tiles jump under the reader's thumb. So each shoot gets a stable shape from
 * its id, varied enough to read as a moodboard rather than a grid.
 */
const SHAPES = [1.25, 1.0, 1.4, 1.15, 1.33];
function shapeFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SHAPES[Math.abs(h) % SHAPES.length];
}

/** Greedy two-column split: each tile goes under whichever column is shorter. */
function columns(stories: StoryWithAuthor[]): [StoryWithAuthor[], StoryWithAuthor[]] {
  const left: StoryWithAuthor[] = [];
  const right: StoryWithAuthor[] = [];
  let lh = 0;
  let rh = 0;
  for (const s of stories) {
    // The caption under each tile is roughly a fixed 44pt.
    const h = COL_W * shapeFor(s.id) + 44;
    if (lh <= rh) {
      left.push(s);
      lh += h;
    } else {
      right.push(s);
      rh += h;
    }
  }
  return [left, right];
}

/**
 * Explore: the scene's moodboard. This week's theme on top, because a
 * prompt answers "what do I even post?"; then what editors featured; then
 * everything, newest first. Nights used to share this tab as a sub-tab; they
 * have their own now.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId } = useAuth();

  const [scene, setScene] = useState<Scene | null>(null);
  const [theme, setTheme] = useState<WeeklyTheme | null>(null);
  /** Showing only this week's theme posts. */
  const [themeOnly] = useState(false);
  const [stories, setStories] = useState<StoryWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const runRef = useRef(0);

  const themeId = themeOnly ? theme?.id ?? null : null;
  const load = useCallback(async () => {
    const run = ++runRef.current;
    const [res, th] = await Promise.all([getExploreStories(scene, 60, themeId), getCurrentTheme()]);
    if (run !== runRef.current) return;
    setStories(res.data);
    // The board's error is the one worth a banner. A theme that failed to
    // load just isn't shown; the posts underneath are what people came for.
    setError(res.error);
    if (th.error) console.warn("current_theme failed", th.error);
    else setTheme(th.data);
    setUnavailable(res.unavailable);
    setLoading(false);
    setRefreshing(false);
  }, [scene, themeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Read through a ref: this callback is memoized on [load], so a plain
  // `loading` here is the value from the first render (true) forever, and the
  // reload on focus never ran.
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useFocusEffect(
    useCallback(() => {
      if (!loadingRef.current) load();
    }, [load])
  );

  // Featured, then everything else. The query already sorts featured first;
  // splitting here gives each its own board so a short featured run doesn't
  // interleave with the newest posts in the masonry.
  const { featured, rest } = useMemo(() => {
    const f = themeOnly ? [] : stories.filter((s) => s.featured_at);
    const r = themeOnly ? stories : stories.filter((s) => !s.featured_at);
    return { featured: columns(f), rest: columns(r) };
  }, [stories, themeOnly]);
  const hasFeatured = featured[0].length + featured[1].length > 0;
  const open = (id: string) => router.push({ pathname: "/story/[id]", params: { id } });
  const post = (forTheme: boolean) =>
    router.push({ pathname: "/story/quick", params: forTheme ? { theme: "1" } : {} });
  const label = sceneLabel(scene);

  const board = ([left, right]: [StoryWithAuthor[], StoryWithAuthor[]]) => (
    <View style={styles.board}>
      {[left, right].map((col, ci) => (
        <View key={ci} style={styles.col}>
          {col.map((s) => (
            <Tile key={s.id} story={s} onPress={() => open(s.id)} />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm, paddingBottom: barTop + spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.textSecondary}
          />
        }
      >
        <ScreenTitle
          title="Explore"
          right={
            userId && !unavailable ? (
              <Pressable
                onPress={() => post(false)}
                hitSlop={10}
                style={({ pressed }) => [styles.plus, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="New post"
              >
                <Plus size={20} color={colors.onBrand} strokeWidth={2.2} />
              </Pressable>
            ) : undefined
          }
        />

        <SceneChips<Scene | null> value={scene} onChange={setScene} allLabel="All" />

        <ErrorBanner message={error} />

        {loading ? (
          <View style={styles.board}>
            <View style={styles.col}>
              <Skeleton height={COL_W * 1.3} radius={radii.md} />
              <Skeleton height={COL_W * 1.1} radius={radii.md} />
            </View>
            <View style={styles.col}>
              <Skeleton height={COL_W} radius={radii.md} />
              <Skeleton height={COL_W * 1.4} radius={radii.md} />
            </View>
          </View>
        ) : unavailable ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Not live yet</Text>
          </View>
        ) : stories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {themeOnly && theme
                ? `No ${theme.title} posts${label ? ` from ${label}` : ""} yet`
                : label
                  ? `Nothing from ${label} yet`
                  : "Nothing here yet"}
            </Text>
            <Text style={styles.emptyBody}>
              Post a photo from your last shoot or event, and tag who made it with you.
            </Text>
            <Button title="Post the first" variant="primary" onPress={() => post(themeOnly)} />
          </View>
        ) : (
          <>
            {/* Headers only when there are two boards to tell apart. */}
            {hasFeatured ? (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Featured</Text>
                {board(featured)}
              </View>
            ) : null}
            {rest[0].length ? (
              <View style={styles.section}>
                {hasFeatured ? <Text style={styles.eyebrow}>Latest</Text> : null}
                {board(rest)}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}


function Tile({ story, onPress }: { story: StoryWithAuthor; onPress: () => void }) {
  const h = Math.round(COL_W * shapeFor(story.id));
  const cover = story.media_urls[0];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}, by ${story.author.name}${story.featured_at ? ", featured" : ""}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View style={[styles.cover, { height: h }]}>
        {cover ? (
          <Image
            source={{ uri: sized(cover, COL_W, h) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
          />
        ) : (
          // No photo: the title, in the serif, on paper.
          <Text style={styles.typeOnly} numberOfLines={5}>
            {story.title}
          </Text>
        )}
        {story.featured_at ? (
          <View style={styles.featured}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        ) : null}
      </View>
      {cover ? (
        <Text style={styles.tileTitle} numberOfLines={1}>
          {story.title}
        </Text>
      ) : null}
      <Text style={styles.tileBy} numberOfLines={1}>
        {story.author.name}
        {story.author.founding ? ` ${FOUNDING_MARK}` : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: GUTTER, gap: spacing.lg },
  board: { flexDirection: "row", gap: COL_GAP, alignItems: "flex-start" },
  col: { flex: 1, gap: spacing.lg },
  pressed: { opacity: 0.9 },
  cover: {
    width: "100%",
    borderRadius: radii.photo,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    justifyContent: "flex-end",
  },
  typeOnly: { ...typography.display2, padding: spacing.md },
  // White label on the photo, not a scrim over it.
  featured: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  featuredText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.text },
  tileTitle: { ...typography.bodyStrong, marginTop: spacing.sm },
  tileBy: { ...typography.caption },
  empty: { alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.display2 },
  emptyBody: { ...typography.body, color: colors.textSecondary },

  plus: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },

  themeLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  themeWho: { flexShrink: 1 },
  themeText: { ...typography.caption, color: colors.textSecondary },
  themeName: { fontFamily: fonts.semibold, color: colors.text },
  // Selected reads as underlined ink, not a second colour.
  themeNameActive: { color: colors.text, textDecorationLine: "underline" },
  themeDot: { ...typography.caption, color: colors.textSecondary },
  themeToggle: { ...typography.caption, fontFamily: fonts.semibold, color: colors.brandText },
});
