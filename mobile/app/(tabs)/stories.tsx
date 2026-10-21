import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ImageIcon } from "lucide-react-native";

import { FOUNDING_MARK } from "@/components/IdentityLine";
import { SceneChips } from "@/components/SceneChips";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { sized } from "@/lib/imageUrl";
import { sceneLabel, type Scene } from "@/lib/scenes";
import { getExploreStories, type StoryWithAuthor } from "@/lib/stories";
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
 * Explore: the scene's moodboard. Shoots people made, featured ones first,
 * then the newest. Nights used to share this tab as a sub-tab; they have
 * their own now.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barTop = useBarTop();
  const { userId } = useAuth();

  const [scene, setScene] = useState<Scene | null>(null);
  const [stories, setStories] = useState<StoryWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const runRef = useRef(0);

  const load = useCallback(async () => {
    const run = ++runRef.current;
    const res = await getExploreStories(scene);
    if (run !== runRef.current) return;
    setStories(res.data);
    setError(res.error);
    setUnavailable(res.unavailable);
    setLoading(false);
    setRefreshing(false);
  }, [scene]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const [left, right] = useMemo(() => columns(stories), [stories]);
  const open = (id: string) => router.push({ pathname: "/story/[id]", params: { id } });
  const label = sceneLabel(scene);

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
          action={
            userId && !unavailable
              ? { label: "Add", onPress: () => router.push("/story/new"), accessibilityLabel: "Add a shoot" }
              : undefined
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
              {label ? `Nothing from ${label} yet` : "Nothing here yet"}
            </Text>
            <Text style={styles.emptyBody}>Post a shoot you made and credit who made it with you.</Text>
            <Button title="Add a shoot" variant="primary" onPress={() => router.push("/story/new")} />
          </View>
        ) : (
          <View style={styles.board}>
            {[left, right].map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map((s) => (
                  <Tile key={s.id} story={s} onPress={() => open(s.id)} />
                ))}
              </View>
            ))}
          </View>
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
          <ImageIcon size={24} color={colors.iconFaint} strokeWidth={1.4} />
        )}
        {story.featured_at ? (
          <View style={styles.featured}>
            <Text style={styles.featuredText}>{FOUNDING_MARK} Featured</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {story.title}
      </Text>
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
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  // White label on the photo, not a scrim over it.
  featured: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  featuredText: { ...typography.micro, fontFamily: fonts.semibold, color: colors.accentInk },
  tileTitle: { ...typography.bodyStrong, marginTop: spacing.sm },
  tileBy: { ...typography.caption },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyTitle: { ...typography.headline, textAlign: "center" },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
