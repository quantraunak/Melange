import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { BookOpen, CalendarRange, Pencil, Users } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Glass } from "@/components/ui/Glass";
import { GlassButton } from "@/components/ui/GlassButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, fonts, radii, shadows, typography } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getStories, storyDate, type StoryWithAuthor } from "@/lib/stories";

const TAB_BAR_CLEARANCE = 112;

/**
 * Stories — what people already made.
 *
 * The swipe deck is work that is looking for people; this is work that
 * happened. It is the half of the app that is worth opening on a day when
 * nobody has posted a project, because anyone can write up a collaboration
 * from last year, including one made entirely off Melange.
 */
export default function StoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const [stories, setStories] = useState<StoryWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    const res = await getStories();
    setStories(res.data);
    setError(res.error);
    setUnavailable(res.unavailable);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
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
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>The record</Text>
            <Text style={styles.heading}>Stories</Text>
          </View>
        </View>
        <Text style={styles.subhead}>
          Work that actually happened. Who made it, and how.
        </Text>

        <ErrorBanner message={error} />

        {loading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={260} radius={radii.lg} />
            <Skeleton height={260} radius={radii.lg} />
          </View>
        ) : unavailable ? (
          <Glass style={styles.empty} elevated>
            <BookOpen size={28} color={colors.iconFaint} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>Stories aren&apos;t live yet</Text>
            <Text style={styles.emptyBody}>
              The database needs <Text style={styles.mono}>09_stories.sql</Text> applied before
              anyone can post one. Everything else in the app works as normal.
            </Text>
          </Glass>
        ) : stories.length === 0 ? (
          <Glass style={styles.empty} elevated>
            <BookOpen size={28} color={colors.iconFaint} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>No stories yet</Text>
            <Text style={styles.emptyBody}>
              Post something you already made. It does not have to be recent, and your
              collaborators do not have to be on Melange.
            </Text>
            <Pressable onPress={() => router.push("/story/new")} style={styles.emptyCta}>
              <Pencil size={14} color={colors.onBrand} />
              <Text style={styles.emptyCtaText}>Write the first one</Text>
            </Pressable>
          </Glass>
        ) : (
          <View style={{ gap: 18 }}>
            {stories.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                onPress={() => router.push({ pathname: "/story/[id]", params: { id: s.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {!unavailable && userId ? (
        <View style={[styles.fab, { bottom: TAB_BAR_CLEARANCE }]} pointerEvents="box-none">
          <GlassButton
            accessibilityLabel="Post a story"
            onPress={() => router.push("/story/new")}
            size={58}
            solid={colors.accent}
          >
            <Pencil size={24} color={colors.white} strokeWidth={2.4} />
          </GlassButton>
        </View>
      ) : null}
    </View>
  );
}

function StoryCard({ story, onPress }: { story: StoryWithAuthor; onPress: () => void }) {
  const hero = story.media_urls[0];
  const when = storyDate(story);
  const shown = story.credits.slice(0, 3);
  const extra = story.credits.length - shown.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}, a story by ${story.author.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {hero ? (
        <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" transition={160} />
      ) : (
        <View style={[styles.hero, styles.heroEmpty]}>
          <BookOpen size={30} color={colors.iconFaint} strokeWidth={1.2} />
        </View>
      )}

      {story.media_urls.length > 1 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{story.media_urls.length}</Text>
        </View>
      ) : null}

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {story.title}
        </Text>

        {story.credits.length ? (
          <View style={styles.withRow}>
            <Users size={13} color={colors.iconFaint} />
            <ChipRow style={{ flex: 1 }}>
              {shown.map((c, i) => (
                <Chip
                  key={`${c.name}-${i}`}
                  label={c.role ? `${c.name} · ${c.role}` : c.name}
                  size="sm"
                  tone={c.user_id ? "accent" : "neutral"}
                />
              ))}
              {extra > 0 ? <Chip label={`+${extra}`} size="sm" tone="outline" /> : null}
            </ChipRow>
          </View>
        ) : null}

        {story.story ? (
          <Text style={styles.excerpt} numberOfLines={2}>
            {story.story}
          </Text>
        ) : null}

        <View style={styles.byRow}>
          <Avatar creator={story.author} size="sm" />
          <Text style={styles.byText} numberOfLines={1}>
            <Text style={styles.byName}>{story.author.name}</Text>
            {story.author.role ? `  ·  ${story.author.role}` : ""}
          </Text>
          {when ? (
            <View style={styles.when}>
              <CalendarRange size={12} color={colors.iconFaint} />
              <Text style={styles.whenText}>{when}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: TAB_BAR_CLEARANCE + 24, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-end" },
  eyebrow: typography.eyebrow,
  heading: typography.display1,
  subhead: { ...typography.caption, marginTop: -8, marginBottom: 2 },

  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    ...shadows.card,
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },
  hero: { width: "100%", height: 220, backgroundColor: colors.bg },
  heroEmpty: { alignItems: "center", justifyContent: "center" },
  countBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    minWidth: 26,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { ...typography.micro, color: colors.text, fontFamily: fonts.semibold },
  cardBody: { padding: 16, gap: 9 },
  cardTitle: { ...typography.title },
  withRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  excerpt: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  byRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  byText: { ...typography.caption, flex: 1 },
  byName: { color: colors.text, fontFamily: fonts.semibold },
  when: { flexDirection: "row", alignItems: "center", gap: 4 },
  whenText: { ...typography.micro },

  empty: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center", gap: 10 },
  emptyTitle: { ...typography.headline, textAlign: "center" },
  emptyBody: { ...typography.caption, textAlign: "center", lineHeight: 20 },
  mono: { fontFamily: fonts.semibold, color: colors.text },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    marginTop: 4,
  },
  emptyCtaText: { color: colors.onBrand, fontFamily: fonts.semibold },

  fab: { position: "absolute", right: 20 },
});
