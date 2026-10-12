import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin } from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui/Chip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuth } from "@/lib/auth";
import { getProfile, type Profile } from "@/lib/db";
import { sized } from "@/lib/imageUrl";
import {
  getOpenProjectsBy,
  getStoriesForUser,
  storyDate,
  type StoryWithAuthor,
} from "@/lib/stories";
import { colors, GUTTER, radii, spacing, typography } from "@/lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const TILE = (SCREEN_W - GUTTER * 2 - spacing.sm * 2) / 3;

/**
 * Someone else's profile.
 *
 * It answers exactly one question — is this person worth working with — so it
 * carries only the evidence: what they have made, who they made it with, and
 * the photographs they chose to stand behind. No rating, because a five-star
 * average over the two or three collaborations anyone does in a year is noise
 * wearing the costume of a number.
 *
 * Deliberately not here: anything you can act on about your own account. This
 * is a record, not a console.
 */
export default function PublicProfileScreen() {
  const { userId: viewedId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { userId: me } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [work, setWork] = useState<StoryWithAuthor[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!viewedId) return;
    setLoading(true);
    const [p, stories, projects] = await Promise.all([
      getProfile(viewedId),
      getStoriesForUser(viewedId),
      getOpenProjectsBy(viewedId),
    ]);
    setProfile(p.data);
    setError(p.error);
    setWork(stories.data);
    // Profiles carry no city of their own, so the one on their most recent
    // open project stands in. It is the city they are actually working in,
    // which is the thing a reader wants to know anyway.
    setCity(projects.data?.find((pr) => pr.location)?.location ?? null);
    setLoading(false);
  }, [viewedId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Your own profile is the Profile tab, which can edit. Landing here from a
     credit on your own work would otherwise be a dead end that looks broken. */
  useEffect(() => {
    if (me && viewedId && me === viewedId) router.replace("/(tabs)/profile");
  }, [me, viewedId, router]);

  const roles = useMemo(() => {
    const out = [profile?.role, ...(profile?.skills ?? [])].filter(
      (r): r is string => !!r && !!r.trim()
    );
    return [...new Set(out)].slice(0, 4);
  }, [profile]);

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {header}
        <View style={styles.loading}>
          <ErrorBanner message={error || "We couldn't load this profile."} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <Avatar creator={{ name: profile.name, avatar_url: profile.avatar_url }} size="xl" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>
              {profile.name}
            </Text>
            {city ? (
              <View style={styles.cityRow}>
                <MapPin size={13} color={colors.iconFaint} strokeWidth={1.8} />
                <Text style={styles.city} numberOfLines={1}>
                  {city}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {roles.length ? (
          <View style={styles.roles}>
            {roles.map((r) => (
              <Chip key={r} label={r} size="sm" />
            ))}
          </View>
        ) : null}

        {profile.bio?.trim() ? <Text style={styles.bio}>{profile.bio.trim()}</Text> : null}

        {profile.portfolio_urls?.length ? (
          <View style={styles.block}>
            <View style={styles.grid}>
              {profile.portfolio_urls.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  source={{ uri: sized(url, TILE, TILE) }}
                  style={styles.tile}
                  contentFit="cover"
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.eyebrow}>Work</Text>
          {work.length === 0 ? (
            <Text style={styles.muted}>Nothing yet.</Text>
          ) : (
            work.map((w) => {
              const names = w.credits.map((c) => c.name).filter(Boolean);
              return (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: "/story/[id]", params: { id: w.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  {w.media_urls[0] ? (
                    <Image
                      source={{ uri: sized(w.media_urls[0], 44, 44) }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {w.title}
                    </Text>
                    {names.length ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        with {names.slice(0, 3).join(", ")}
                      </Text>
                    ) : null}
                  </View>
                  {storyDate(w) ? <Text style={styles.rowWhen}>{storyDate(w)}</Text> : null}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xxxl },

  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { ...typography.display2, color: colors.text },
  cityRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  city: { ...typography.caption, color: colors.textSecondary },

  roles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  bio: { ...typography.body, color: colors.textSecondary, marginTop: spacing.lg },

  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: { ...typography.eyebrow, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: TILE,
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSunken,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rowWhen: { ...typography.micro, color: colors.textTertiary },
  thumb: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.bg },
  thumbEmpty: { backgroundColor: colors.surfaceSunken },
});
